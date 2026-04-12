/**
 * Client-side autoplay planning (ADR0005): calls Gemini or OpenAI-compatible HTTP
 * directly from the browser. No dashboard `POST /api/nl/planner` hop.
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { AdventureDatabase } from "@adventure-nl/nl-glue";
import {
  AutoplayPlannerResponseSchema,
  buildAutoplayPlannerPrompt,
  coerceAutoplayPlannerJson,
  finalizeAutoplayPlannerResponse,
  openAiAutoplayPlannerJsonSchema,
  parseJsonObjectFromLlmText,
  vocabTokensForLlmEnums,
  type AutoplayPlannerResponse,
  type PlannerUserPromptInput,
} from "@adventure-nl/nl-glue";

export type BrowserPlannerCredentialsPayload = {
  readonly googleApiKey?: string;
  readonly httpBaseUrl?: string;
  readonly httpApiKey?: string;
  readonly httpUseJsonSchema?: boolean;
};

function chatCompletionsUrl(baseUrl: string): string {
  const u = baseUrl.replace(/\/+$/, "");
  if (u.endsWith("/v1")) return `${u}/chat/completions`;
  return `${u}/v1/chat/completions`;
}

async function postOpenAiCompatibleChat(
  url: string,
  apiKey: string | undefined,
  model: string,
  userContent: string,
  responseFormat: Record<string, unknown> | undefined,
  generation: { temperature: number; max_tokens?: number },
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
    temperature: generation.temperature ?? 0.2,
    stream: false,
  };
  if (generation.max_tokens !== undefined) {
    body.max_tokens = generation.max_tokens;
  }
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
    const snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text;
    throw new Error(`OpenAI-compatible HTTP ${res.status}: ${snippet}`);
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
 * Run one autoplay planner step in the browser using session credentials from
 * {@link BrowserPlannerCredentialsPayload} (via SSE / `GET /api/text-llm`).
 */
export async function planAutoplayInBrowser(
  db: AdventureDatabase,
  options: {
    plannerUserPrompt: PlannerUserPromptInput;
    recentGameTextForRepair?: string;
    includeDatHelpInSystem?: boolean;
  },
  args: {
    providerId: "google" | "http";
    modelId: string;
    browserPlanner: BrowserPlannerCredentialsPayload;
  },
): Promise<AutoplayPlannerResponse> {
  const { providerId, modelId, browserPlanner } = args;
  const prompt = buildAutoplayPlannerPrompt(db, options.plannerUserPrompt, {
    includeDatHelpInSystem: options.includeDatHelpInSystem !== false,
  });

  if (providerId === "google") {
    const apiKey = browserPlanner.googleApiKey?.trim();
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for browser-side planning");
    }
    const tokenEnum = vocabTokensForLlmEnums(db);
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({
      model: modelId,
      generationConfig: {
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
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const parsedUnknown = JSON.parse(text) as unknown;
    const raw = AutoplayPlannerResponseSchema.parse(
      coerceAutoplayPlannerJson(parsedUnknown),
    );
    return finalizeAutoplayPlannerResponse(
      db,
      raw,
      options.recentGameTextForRepair,
    );
  }

  const baseUrl = browserPlanner.httpBaseUrl?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing httpBaseUrl for browser-side planning (HTTP provider)",
    );
  }
  const url = chatCompletionsUrl(baseUrl);
  const apiKey = browserPlanner.httpApiKey?.trim();
  const tokens = vocabTokensForLlmEnums(db);
  const useJsonSchema = Boolean(browserPlanner.httpUseJsonSchema);
  const responseFormat = useJsonSchema
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: "autoplay_planner",
          strict: true,
          schema: openAiAutoplayPlannerJsonSchema(tokens),
        },
      }
    : undefined;

  const rawText = await postOpenAiCompatibleChat(
    url,
    apiKey && apiKey.length > 0 ? apiKey : undefined,
    modelId,
    prompt,
    responseFormat,
    { temperature: 0.2 },
  );

  const parsedUnknown = parseJsonObjectFromLlmText(rawText);
  const raw = AutoplayPlannerResponseSchema.parse(
    coerceAutoplayPlannerJson(parsedUnknown),
  );
  return finalizeAutoplayPlannerResponse(
    db,
    raw,
    options.recentGameTextForRepair,
  );
}
