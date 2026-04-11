import { afterEach, describe, expect, it } from "vitest";
import {
  LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
  LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
} from "@adventure-nl/nl-glue";
import { buildLlmPackagingDiscoveryPayload } from "./llmPackagingProfile.js";

describe("buildLlmPackagingDiscoveryPayload", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_HTTP_JSON_SCHEMA;
  });

  it("includes all provider ids with aligned limits and schema wiring", () => {
    const { byProvider } = buildLlmPackagingDiscoveryPayload();
    expect(new Set(Object.keys(byProvider)).size).toBe(3);
    for (const id of ["mlx", "http", "google"] as const) {
      expect(byProvider[id]).toMatchObject({
        providerId: id,
        supportedSchemaModeIds: ["interpret", "planner"],
        limits: {
          ssePromptCapChars: LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
          plannerMergedPreviewMaxChars:
            LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
          plannerStructuredSystemPreviewMaxChars:
            LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
          plannerStructuredUserPreviewMaxChars:
            LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
          autoplayRecentRawTailMaxChars:
            LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS,
        },
        interpretRecentGameTextMaxChars: {
          full: LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
          compact: LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
        },
      });
    }
  });

  it("marks MLX planner as structured-split capable and JSON-without-native-schema", () => {
    const p = buildLlmPackagingDiscoveryPayload().byProvider.mlx;
    expect(p.plannerUserPrompt).toEqual({
      supportsSingleString: true,
      supportsSystemUserObject: true,
      mlxStructuredPlannerSplit: true,
    });
    expect(p.jsonSchemaByMode.interpret.wire).toBe("none_prompt_json_only");
    expect(p.jsonSchemaByMode.planner.wire).toBe("none_prompt_json_only");
  });

  it("marks Google as Gemini responseSchema subset", () => {
    const p = buildLlmPackagingDiscoveryPayload().byProvider.google;
    expect(p.jsonSchemaByMode.interpret.wire).toBe(
      "gemini_response_schema_subset",
    );
    expect(p.jsonSchemaByMode.planner.wire).toBe(
      "gemini_response_schema_subset",
    );
    expect(p.plannerUserPrompt.mlxStructuredPlannerSplit).toBeUndefined();
  });

  it("reflects HTTP OpenAI json_schema flag from env", () => {
    delete process.env.ADVENTURE_NL_HTTP_JSON_SCHEMA;
    const off = buildLlmPackagingDiscoveryPayload().byProvider.http;
    expect(off.httpOpenAiJsonSchemaStructuredOutputsActive).toBe(false);
    expect(off.jsonSchemaByMode.interpret.wire).toBe("none_prompt_json_only");

    process.env.ADVENTURE_NL_HTTP_JSON_SCHEMA = "1";
    const on = buildLlmPackagingDiscoveryPayload().byProvider.http;
    expect(on.httpOpenAiJsonSchemaStructuredOutputsActive).toBe(true);
    expect(on.jsonSchemaByMode.interpret.wire).toBe(
      "openai_json_schema_strict",
    );
    expect(on.jsonSchemaByMode.planner.wire).toBe("openai_json_schema_strict");
  });
});
