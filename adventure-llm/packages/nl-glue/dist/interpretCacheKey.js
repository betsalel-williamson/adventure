import { recentGameTextSliceForInterpretPrompt } from "./adventureNlPrompts.js";
import { interpretCacheKeyMaterialHash } from "./interpretCacheKeyMaterial.js";
/**
 * Stable cache key for interpret, including layout flags and the same recent-game tail as the prompt.
 */
export function interpretCacheKeyFromBuildOptions(args) {
    const slice = recentGameTextSliceForInterpretPrompt(args.recentGameText, args.compact);
    const layout = `compact=${args.compact};structured=${args.structuredDashboard}`;
    return interpretCacheKeyMaterialHash([
        args.providerId,
        args.modelId,
        args.userText,
        layout,
        slice,
    ]);
}
//# sourceMappingURL=interpretCacheKey.js.map