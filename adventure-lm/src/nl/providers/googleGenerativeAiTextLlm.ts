import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { interpretCacheKeyFromBuildOptions } from "../interpretCacheKey.js";
import {
  AutoplayPlannerResponseSchema,
  InterpretedCommandSchema,
  buildAutoplayPlannerPrompt,
  buildInterpretSystemAndUserPrompt,
  coerceAutoplayPlannerJson,
  coerceInterpretedCommandJson,
  finalizeAutoplayPlannerResponse,
  finalizeInterpretedCommand,
  resolveInterpretPromptBuildOptions,
  vocabTokensForLlmEnums,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
  type InterpretPlayerInputOptions,
  type PlannerUserPromptInput,
  type TextLlm,
} from "@adventure-lm/lm-glue";
import type { AdventureDatabase } from "../../dat/types.js";
import { resolvedGeminiTextModel } from "../geminiModels.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  writeCachedInterpreted,
} from "../llmDebug.js";
import { loadCachedInterpretIfHit } from "../interpretDiskCache.js";

export type GoogleGenerativeAiTextLlmOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()`. */
  model?: string;
};

/**
 * Google Generative AI (Gemini) implementation of {@link TextLlm} for NL and autoplay.
 */
export class GoogleGenerativeAiTextLlm implements TextLlm {
  readonly providerId = "google" as const;
  readonly modelId: string;
  private readonly apiKey: string;
  private googleTemperature: number | undefined = undefined;
  private googleMaxOutputTokens: number | undefined = undefined;

  constructor(options: GoogleGenerativeAiTextLlmOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.model?.trim() || resolvedGeminiTextModel();
  }

  setDashboardGenerationOptions(opts: {
    temperature?: number;
    maxOutputTokens?: number;
  }): void {
    if (opts.temperature !== undefined) {
      this.googleTemperature = Math.max(0, Math.min(2, opts.temperature));
    }
    if (opts.maxOutputTokens !== undefined) {
      const n = Math.floor(opts.maxOutputTokens);
      this.googleMaxOutputTokens = n >= 1 ? n : undefined;
    }
  }

  getDashboardGenerationOptions(): {
    temperature?: number;
    maxOutputTokens?: number;
  } {
    return {
      ...(this.googleTemperature !== undefined
        ? { temperature: this.googleTemperature }
        : {}),
      ...(this.googleMaxOutputTokens !== undefined
        ? { maxOutputTokens: this.googleMaxOutputTokens }
        : {}),
    };
  }

  private geminiGenOverrides(): {
    temperature?: number;
    maxOutputTokens?: number;
  } {
    const o: { temperature?: number; maxOutputTokens?: number } = {};
    if (this.googleTemperature !== undefined)
      o.temperature = this.googleTemperature;
    if (this.googleMaxOutputTokens !== undefined)
      o.maxOutputTokens = this.googleMaxOutputTokens;
    return o;
  }

  async interpretPlayerInput(
    userText: string,
    db: AdventureDatabase,
    options: InterpretPlayerInputOptions,
  ): Promise<InterpretedCommand> {
    const cacheDir = resolveCacheDir();
    const { compact, structuredDashboard } = resolveInterpretPromptBuildOptions(
      this.providerId,
      options.promptStyle,
    );
    const cacheKey = interpretCacheKeyFromBuildOptions({
      userText,
      modelId: this.modelId,
      providerId: this.providerId,
      recentGameText: options.recentGameText,
      compact,
      structuredDashboard,
    });

    const cacheHit = await loadCachedInterpretIfHit({
      cacheDir,
      cacheKey,
      db,
      userText,
      recentGameText: options.recentGameText,
      providerId: this.providerId,
      modelId: this.modelId,
    });
    if (cacheHit) return cacheHit;

    process.stderr.write("adventure-lm: translating with text model…\n");

    const tokenEnum = vocabTokensForLlmEnums(db);
    const gen = new GoogleGenerativeAI(this.apiKey);
    const model = gen.getGenerativeModel({
      model: this.modelId,
      generationConfig: {
        ...this.geminiGenOverrides(),
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            primaryToken: {
              type: SchemaType.STRING,
              description:
                "One word from the game vocabulary (max 5 letters); must be one of the enum values.",
              enum: tokenEnum,
            },
            secondaryToken: {
              type: SchemaType.STRING,
              description:
                "Optional second word from the same vocabulary, or omit this field.",
              enum: tokenEnum,
            },
            confidence: { type: SchemaType.NUMBER },
          },
          required: ["primaryToken"],
        },
      },
    });

    const prompt = buildInterpretSystemAndUserPrompt(
      db,
      userText,
      options.recentGameText,
      { compact, structuredDashboard, providerId: this.providerId },
    );

    await appendInteractionLog({
      event: "text_llm_request",
      provider: this.providerId,
      userText,
      model: this.modelId,
      promptLength: prompt.length,
      prompt,
    });

    const startedMs = Date.now();
    const res = await model.generateContent(prompt);
    const durationMs = Date.now() - startedMs;
    const text = res.response.text();
    const parsedJson = JSON.parse(text) as unknown;
    const rawCmd = InterpretedCommandSchema.parse(
      coerceInterpretedCommandJson(parsedJson),
    );
    const cmd = finalizeInterpretedCommand(
      db,
      userText,
      rawCmd,
      options.recentGameText,
    );

    await appendInteractionLog({
      event: "text_llm_response",
      provider: this.providerId,
      userText,
      model: this.modelId,
      cached: false,
      durationMs,
      rawJson: text,
      parsed: rawCmd,
      repaired: cmd,
    });

    if (cacheDir) {
      await writeCachedInterpreted(cacheDir, cacheKey, rawCmd);
    }

    return cmd;
  }

  async planAutoplay(
    db: AdventureDatabase,
    options: {
      plannerUserPrompt: PlannerUserPromptInput;
      recentGameTextForRepair?: string;
      includeDatHelpInSystem?: boolean;
    },
  ): Promise<AutoplayPlannerResponse> {
    process.stderr.write("adventure-lm: autoplay — planning next move…\n");

    const tokenEnum = vocabTokensForLlmEnums(db);
    const gen = new GoogleGenerativeAI(this.apiKey);
    const model = gen.getGenerativeModel({
      model: this.modelId,
      generationConfig: {
        ...this.geminiGenOverrides(),
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            primaryToken: {
              type: SchemaType.STRING,
              description:
                "Next parser token from the game vocabulary; must be one of the enum values.",
              enum: tokenEnum,
            },
            secondaryToken: {
              type: SchemaType.STRING,
              description:
                "Optional second vocabulary word, or omit this field.",
              enum: tokenEnum,
            },
            confidence: { type: SchemaType.NUMBER },
            continuePlaying: {
              type: SchemaType.BOOLEAN,
              description:
                "False to end the session (no further commands). Default true.",
            },
          },
          required: ["primaryToken"],
        },
      },
    });

    const prompt = buildAutoplayPlannerPrompt(db, options.plannerUserPrompt, {
      includeDatHelpInSystem: options.includeDatHelpInSystem !== false,
    });

    await appendInteractionLog({
      event: "text_llm_autoplay_request",
      provider: this.providerId,
      model: this.modelId,
      promptLength: prompt.length,
      prompt,
    });

    const startedMs = Date.now();
    const res = await model.generateContent(prompt);
    const durationMs = Date.now() - startedMs;
    const text = res.response.text();
    const parsedUnknown = JSON.parse(text) as unknown;
    const raw = AutoplayPlannerResponseSchema.parse(
      coerceAutoplayPlannerJson(parsedUnknown),
    );
    const out = finalizeAutoplayPlannerResponse(
      db,
      raw,
      options.recentGameTextForRepair,
    );

    await appendInteractionLog({
      event: "text_llm_autoplay_response",
      provider: this.providerId,
      model: this.modelId,
      durationMs,
      rawJson: text,
      parsed: raw,
      repaired: out,
    });

    return out;
  }

  async generateUnstructured(prompt: string): Promise<string> {
    const gen = new GoogleGenerativeAI(this.apiKey);
    const model = gen.getGenerativeModel({ model: this.modelId });
    const res = await model.generateContent(prompt);
    return res.response.text();
  }
}
