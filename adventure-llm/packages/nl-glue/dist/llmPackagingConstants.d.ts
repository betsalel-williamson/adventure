/**
 * Single source of truth for limits enforced by NL packaging and preview paths
 * (effective planner payload, autoplay session memory, interpret prompts).
 * Discovery API may mirror these for clients ({@link buildLlmPackagingDiscoveryPayload} in app).
 */
/** Cap on embedded recent game text in interpret prompts ({@link recentGameTextSliceForInterpretPrompt}). */
export declare const LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL = 2500;
export declare const LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT = 1200;
/** Truncation applied to planner/interpret prompts in SSE payloads only. */
export declare const LLM_PACKAGING_SSE_PROMPT_CAP_CHARS = 200000;
/** Preview truncation for planner strings in dashboard/SSE (merged blob path). */
export declare const LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS = 12000;
/** Preview truncation when MLX structured split exposes separate system/user. */
export declare const LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS = 8000;
/**
 * Autoplay session memory: max retained chars of raw game tail for planner context
 * ({@link AutoplaySessionMemory} internal buffer).
 */
export declare const LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS = 48000;
//# sourceMappingURL=llmPackagingConstants.d.ts.map