import type { TextLlmProviderId } from "./textLlmContract.js";
/**
 * Stable cache key for interpret, including layout flags and the same recent-game tail as the prompt.
 */
export declare function interpretCacheKeyFromBuildOptions(args: {
    readonly userText: string;
    readonly modelId: string;
    readonly providerId: TextLlmProviderId;
    readonly recentGameText: string | undefined;
    readonly compact: boolean;
    readonly structuredDashboard: boolean;
}): string;
//# sourceMappingURL=interpretCacheKey.d.ts.map