/**
 * Single source of truth for limits enforced by NL packaging and preview paths
 * ({@link effectivePlannerSendPayload}, autoplay session memory, interpret prompts).
 * Exposed to clients via {@link buildLlmPackagingDiscoveryPayload}.
 */

/** Cap on embedded recent game text in interpret prompts ({@link recentGameTextSliceForInterpretPrompt}). */
export const LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL = 2500;
export const LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT = 1200;

/** Truncation applied to planner/interpret prompts in SSE payloads only. */
export const LLM_PACKAGING_SSE_PROMPT_CAP_CHARS = 200_000;

/** Preview truncation for planner strings in dashboard/SSE (merged blob path). */
export const LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS = 12_000;

/** Preview truncation when MLX structured split exposes separate system/user. */
export const LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS = 8_000;

/**
 * Autoplay session memory: max retained chars of raw game tail for planner context
 * ({@link AutoplaySessionMemory} internal buffer).
 */
export const LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS = 48_000;
