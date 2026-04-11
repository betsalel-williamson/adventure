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
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  parseJsonObjectFromLlmText,
  resolveInterpretPromptBuildOptions,
  vocabTokensForLlmEnums,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
  type InterpretPlayerInputOptions,
  type PlannerUserPromptInput,
  type TextLlm,
} from "@adventure-llm/nl-glue";
import type { AdventureDatabase } from "../../dat/types.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  writeCachedInterpreted,
} from "../llmDebug.js";
import { httpStatusEligibleForRetry, LlmTransportError } from "../llmErrors.js";
import { loadCachedInterpretIfHit } from "../interpretDiskCache.js";
export type HttpOpenAiCompatibleTextLlmOptions = {
  /** e.g. `http://127.0.0.1:11434/v1` (Ollama) */
  baseUrl: string;
  model: string;
  /** Optional; omit for Ollama on localhost */
  apiKey?: string;
  /**
   * When true, sends `response_format: { type: "json_schema", ... }` (OpenAI structured outputs).
   * Many OpenAI-compatible servers (e.g. Ollama) do not support this; use with the official API or vLLM that implements it.
   */
  useJsonSchemaResponseFormat?: boolean;
};

function chatCompletionsUrl(baseUrl: string): string {
  const u = baseUrl.replace(/\/+$/, "");
  if (u.endsWith("/v1")) return `${u}/chat/completions`;
  return `${u}/v1/chat/completions`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveHttpRetryMaxAttempts(): number {
  const v = process.env.ADVENTURE_LLM_HTTP_RETRY_ATTEMPTS?.trim();
  if (v === undefined || v === "") return 1;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.floor(n) : 1;
}

async function postChatCompletion(
  url: string,
  apiKey: string | undefined,
  model: string,
  userContent: string,
  responseFormat?: Record<string, unknown>,
  generation?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey !== undefined && apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: userContent }],
    temperature: generation?.temperature ?? 0.2,
    stream: false,
  };
  if (generation?.max_tokens !== undefined) {
    body.max_tokens = generation.max_tokens;
  }
  if (responseFormat !== undefined) {
    body.response_format = responseFormat;
  }

  const maxAttempts = resolveHttpRetryMaxAttempts();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      const snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text;
      if (httpStatusEligibleForRetry(res.status) && attempt < maxAttempts) {
        await sleepMs(400 * attempt);
        continue;
      }
      throw new LlmTransportError(
        `OpenAI-compatible HTTP ${res.status}: ${snippet}`,
        { status: res.status, bodySnippet: snippet },
      );
    }

    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new LlmTransportError(
        "OpenAI-compatible response missing choices[0].message.content",
      );
    }
    return content;
  }

  throw new LlmTransportError(
    "OpenAI-compatible: exhausted HTTP retries unexpectedly",
  );
}

/**
 * OpenAI-compatible `/v1/chat/completions` (Ollama, LM Studio, vLLM, etc.).
 */
function httpUseJsonSchemaFromEnv(): boolean {
  const v = process.env.ADVENTURE_LLM_HTTP_JSON_SCHEMA?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export class HttpOpenAiCompatibleTextLlm implements TextLlm {
  readonly providerId = "http" as const;
  readonly modelId: string;
  private readonly url: string;
  private readonly apiKey: string | undefined;
  private readonly useJsonSchemaResponseFormat: boolean;
  private chatTemperature = 0.2;
  private chatMaxTokens: number | undefined = undefined;

  constructor(options: HttpOpenAiCompatibleTextLlmOptions) {
    this.url = chatCompletionsUrl(options.baseUrl.trim());
    this.modelId = options.model.trim();
    this.apiKey = options.apiKey?.trim() || undefined;
    this.useJsonSchemaResponseFormat =
      options.useJsonSchemaResponseFormat ?? httpUseJsonSchemaFromEnv();
  }

  /** Mutable for the web dashboard (interpret + autoplay + unstructured). */
  setDashboardGenerationOptions(opts: {
    temperature?: number;
    maxTokens?: number;
  }): void {
    if (opts.temperature !== undefined)
      this.chatTemperature = Math.max(0, Math.min(2, opts.temperature));
    if (opts.maxTokens !== undefined) {
      const n = Math.floor(opts.maxTokens);
      this.chatMaxTokens = n >= 1 ? n : undefined;
    }
  }

  getDashboardGenerationOptions(): {
    temperature: number;
    maxTokens?: number;
  } {
    return {
      temperature: this.chatTemperature,
      ...(this.chatMaxTokens !== undefined
        ? { maxTokens: this.chatMaxTokens }
        : {}),
    };
  }

  private chatGen(): { temperature: number; max_tokens?: number } {
    const g: { temperature: number; max_tokens?: number } = {
      temperature: this.chatTemperature,
    };
    if (this.chatMaxTokens !== undefined) g.max_tokens = this.chatMaxTokens;
    return g;
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

    process.stderr.write("adventure-llm: translating with text model…\n");

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

    const tokens = vocabTokensForLlmEnums(db);
    const responseFormat = this.useJsonSchemaResponseFormat
      ? {
          type: "json_schema" as const,
          json_schema: {
            name: "interpreted_command",
            strict: true,
            schema: openAiInterpretCommandJsonSchema(tokens),
          },
        }
      : undefined;

    const startedMs = Date.now();
    const rawText = await postChatCompletion(
      this.url,
      this.apiKey,
      this.modelId,
      prompt,
      responseFormat,
      this.chatGen(),
    );
    const durationMs = Date.now() - startedMs;

    const parsedJson = parseJsonObjectFromLlmText(rawText);
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
      rawJson: rawText,
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
    process.stderr.write("adventure-llm: autoplay — planning next move…\n");

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

    const tokens = vocabTokensForLlmEnums(db);
    const responseFormat = this.useJsonSchemaResponseFormat
      ? {
          type: "json_schema" as const,
          json_schema: {
            name: "autoplay_planner",
            strict: true,
            schema: openAiAutoplayPlannerJsonSchema(tokens),
          },
        }
      : undefined;

    const startedMs = Date.now();
    const rawText = await postChatCompletion(
      this.url,
      this.apiKey,
      this.modelId,
      prompt,
      responseFormat,
      this.chatGen(),
    );
    const durationMs = Date.now() - startedMs;

    const parsedUnknown = parseJsonObjectFromLlmText(rawText);
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
      rawJson: rawText,
      parsed: raw,
      repaired: out,
    });

    return out;
  }

  async generateUnstructured(prompt: string): Promise<string> {
    return postChatCompletion(
      this.url,
      this.apiKey,
      this.modelId,
      prompt,
      undefined,
      this.chatGen(),
    );
  }
}
