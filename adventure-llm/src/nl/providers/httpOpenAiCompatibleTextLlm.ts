import {
  AutoplayPlannerResponseSchema,
  InterpretedCommandSchema,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "../schema.js";
import type { AdventureDatabase } from "../../dat/types.js";
import {
  appendInteractionLog,
  cacheKeyFor,
  readCachedInterpreted,
  resolveCacheDir,
  writeCachedInterpreted,
} from "../llmDebug.js";
import { repairInterpretedCommand } from "../repairInterpreted.js";
import {
  buildAutoplayPlannerPrompt,
  buildInterpretSystemAndUserPrompt,
} from "../adventureNlPrompts.js";
import { parseJsonObjectFromLlmText } from "../jsonFromLlmText.js";
import {
  coerceAutoplayPlannerJson,
  coerceInterpretedCommandJson,
} from "../coerceLlmJson.js";
import type { TextLlm } from "../textLlmContract.js";
import {
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "../gameVocabEnums.js";

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

async function postChatCompletion(
  url: string,
  apiKey: string | undefined,
  model: string,
  userContent: string,
  responseFormat?: Record<string, unknown>,
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
    temperature: 0.2,
    stream: false,
  };
  if (responseFormat !== undefined) {
    body.response_format = responseFormat;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(
      `OpenAI-compatible HTTP ${res.status}: ${text}`,
    ) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }

  const json = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(
      "OpenAI-compatible response missing choices[0].message.content",
    );
  }
  return content;
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

  constructor(options: HttpOpenAiCompatibleTextLlmOptions) {
    this.url = chatCompletionsUrl(options.baseUrl.trim());
    this.modelId = options.model.trim();
    this.apiKey = options.apiKey?.trim() || undefined;
    this.useJsonSchemaResponseFormat =
      options.useJsonSchemaResponseFormat ?? httpUseJsonSchemaFromEnv();
  }

  async interpretPlayerInput(
    userText: string,
    db: AdventureDatabase,
    options: { recentGameText?: string },
  ): Promise<InterpretedCommand> {
    const cacheDir = resolveCacheDir();
    const cacheKey = cacheKeyFor(userText, this.modelId, this.providerId);

    if (cacheDir) {
      const cached = await readCachedInterpreted(cacheDir, cacheKey);
      if (cached) {
        const parsed = InterpretedCommandSchema.safeParse(cached);
        if (parsed.success) {
          const repaired = repairInterpretedCommand(
            userText,
            parsed.data,
            options.recentGameText,
          );
          await appendInteractionLog({
            event: "text_llm_cache_hit",
            provider: this.providerId,
            userText,
            model: this.modelId,
            cacheKey,
            parsed: parsed.data,
            repaired,
          });
          return repaired;
        }
      }
    }

    process.stderr.write("adventure-llm: translating with text LLM…\n");

    const prompt = buildInterpretSystemAndUserPrompt(
      db,
      userText,
      options.recentGameText,
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
    );
    const durationMs = Date.now() - startedMs;

    const parsedJson = parseJsonObjectFromLlmText(rawText);
    const rawCmd = InterpretedCommandSchema.parse(
      coerceInterpretedCommandJson(parsedJson),
    );
    const cmd = repairInterpretedCommand(
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
      plannerUserPrompt: string;
      recentGameTextForRepair?: string;
    },
  ): Promise<AutoplayPlannerResponse> {
    process.stderr.write("adventure-llm: autoplay — planning next move…\n");

    const prompt = buildAutoplayPlannerPrompt(db, options.plannerUserPrompt);

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
    );
    const durationMs = Date.now() - startedMs;

    const parsedUnknown = parseJsonObjectFromLlmText(rawText);
    const raw = AutoplayPlannerResponseSchema.parse(
      coerceAutoplayPlannerJson(parsedUnknown),
    );
    const continuePlaying = raw.continuePlaying ?? true;
    const repaired = repairInterpretedCommand(
      "autoplay",
      {
        primaryToken: raw.primaryToken,
        secondaryToken: raw.secondaryToken,
        confidence: raw.confidence,
      },
      options.recentGameTextForRepair,
    );

    const out: AutoplayPlannerResponse = {
      ...repaired,
      continuePlaying,
    };

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
}
