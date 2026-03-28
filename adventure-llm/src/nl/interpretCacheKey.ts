import { recentGameTextSliceForInterpretPrompt } from "./adventureNlPrompts.js";
import { interpretCacheKeyMaterialHash } from "./llmDebug.js";
import type { TextLlmProviderId } from "./textLlmContract.js";

/**
 * Stable cache key for interpret, including layout flags and the same recent-game tail as the prompt.
 */
export function interpretCacheKeyFromBuildOptions(args: {
  readonly userText: string;
  readonly modelId: string;
  readonly providerId: TextLlmProviderId;
  readonly recentGameText: string | undefined;
  readonly compact: boolean;
  readonly structuredDashboard: boolean;
}): string {
  const slice = recentGameTextSliceForInterpretPrompt(
    args.recentGameText,
    args.compact,
  );
  const layout = `compact=${args.compact};structured=${args.structuredDashboard}`;
  return interpretCacheKeyMaterialHash([
    args.providerId,
    args.modelId,
    args.userText,
    layout,
    slice,
  ]);
}
