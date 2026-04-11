import type { TextLlmProviderId } from "@adventure-llm/nl-glue";
import {
  LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
  LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
} from "@adventure-llm/nl-glue";

/** How structured JSON is enforced on the wire for a logical mode. */
export type LlmJsonSchemaWireKind =
  | "openai_json_schema_strict"
  | "gemini_response_schema_subset"
  | "none_prompt_json_only";

export type LlmSchemaModeId = "interpret" | "planner";

export type LlmPackagingProfile = {
  readonly providerId: TextLlmProviderId;
  readonly logicalModes: readonly ("interpret" | "planner")[];
  readonly plannerUserPrompt: {
    readonly supportsSingleString: true;
    readonly supportsSystemUserObject: true;
    /** MLX: worker accepts system + user separately for structured planner prompts. */
    readonly mlxStructuredPlannerSplit?: boolean;
  };
  readonly interpretRecentGameTextMaxChars: {
    readonly full: number;
    readonly compact: number;
  };
  readonly limits: {
    readonly ssePromptCapChars: number;
    readonly plannerMergedPreviewMaxChars: number;
    readonly plannerStructuredSystemPreviewMaxChars: number;
    readonly plannerStructuredUserPreviewMaxChars: number;
    readonly autoplayRecentRawTailMaxChars: number;
  };
  readonly jsonSchemaByMode: Record<
    LlmSchemaModeId,
    {
      readonly wire: LlmJsonSchemaWireKind;
      readonly notes: string;
    }
  >;
  readonly supportedSchemaModeIds: readonly LlmSchemaModeId[];
  /** HTTP only: `response_format: json_schema` when env enables it. */
  readonly httpOpenAiJsonSchemaStructuredOutputsActive?: boolean;
};

function httpUsesOpenAiJsonSchemaFromEnv(): boolean {
  const v = process.env.ADVENTURE_LLM_HTTP_JSON_SCHEMA?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function profileForProvider(
  providerId: TextLlmProviderId,
): LlmPackagingProfile {
  const limits = {
    ssePromptCapChars: LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
    plannerMergedPreviewMaxChars: LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
    plannerStructuredSystemPreviewMaxChars:
      LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
    plannerStructuredUserPreviewMaxChars:
      LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
    autoplayRecentRawTailMaxChars:
      LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS,
  } as const;

  const interpretRecentGameTextMaxChars = {
    full: LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
    compact: LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
  } as const;

  const base: Omit<
    LlmPackagingProfile,
    | "providerId"
    | "plannerUserPrompt"
    | "jsonSchemaByMode"
    | "httpOpenAiJsonSchemaStructuredOutputsActive"
  > = {
    logicalModes: ["interpret", "planner"],
    limits,
    interpretRecentGameTextMaxChars,
    supportedSchemaModeIds: ["interpret", "planner"],
  };

  if (providerId === "mlx") {
    return {
      ...base,
      providerId,
      plannerUserPrompt: {
        supportsSingleString: true,
        supportsSystemUserObject: true,
        mlxStructuredPlannerSplit: true,
      },
      jsonSchemaByMode: {
        interpret: {
          wire: "none_prompt_json_only",
          notes:
            "MLX worker completes plain text; JSON is parsed and validated in Node (no native JSON Schema attachment).",
        },
        planner: {
          wire: "none_prompt_json_only",
          notes:
            "Planner JSON is requested via prompt text; parsing and repair run in Node.",
        },
      },
    };
  }

  if (providerId === "google") {
    return {
      ...base,
      providerId,
      plannerUserPrompt: {
        supportsSingleString: true,
        supportsSystemUserObject: true,
      },
      jsonSchemaByMode: {
        interpret: {
          wire: "gemini_response_schema_subset",
          notes:
            "Gemini `responseSchema` with STRING enums from vocabulary; subset of JSON Schema (see Google Generative AI SDK).",
        },
        planner: {
          wire: "gemini_response_schema_subset",
          notes:
            "Same structured-output path as interpret; enums from vocabulary tokens.",
        },
      },
    };
  }

  const httpJson = httpUsesOpenAiJsonSchemaFromEnv();
  const httpWire: LlmJsonSchemaWireKind = httpJson
    ? "openai_json_schema_strict"
    : "none_prompt_json_only";
  return {
    ...base,
    providerId,
    plannerUserPrompt: {
      supportsSingleString: true,
      supportsSystemUserObject: true,
    },
    httpOpenAiJsonSchemaStructuredOutputsActive: httpJson,
    jsonSchemaByMode: {
      interpret: {
        wire: httpWire,
        notes: httpJson
          ? "OpenAI-compatible `response_format.type=json_schema` with strict schema from `openAiInterpretCommandJsonSchema` when `ADVENTURE_LLM_HTTP_JSON_SCHEMA` is enabled."
          : "Single user message with prompt text; model returns JSON in content (no `response_format` unless env enables JSON Schema).",
      },
      planner: {
        wire: httpWire,
        notes: httpJson
          ? "Same as interpret: `json_schema` for autoplay planner when env flag is on."
          : "Single user blob with planner text; JSON parsed in Node.",
      },
    },
  };
}

export type LlmPackagingDiscoveryPayload = {
  readonly byProvider: Record<TextLlmProviderId, LlmPackagingProfile>;
};

/**
 * Runtime discovery for editors and clients: limits match {@link effectivePlannerSendPayload}
 * and packaging code paths; HTTP JSON Schema reflects current process env.
 */
export function buildLlmPackagingDiscoveryPayload(): LlmPackagingDiscoveryPayload {
  return {
    byProvider: {
      mlx: profileForProvider("mlx"),
      http: profileForProvider("http"),
      google: profileForProvider("google"),
    },
  };
}
