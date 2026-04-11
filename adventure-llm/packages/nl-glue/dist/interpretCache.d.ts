/**
 * Interpret disk-cache key material (SHA-256) and {@link interpretCacheKeyFromBuildOptions}.
 * Exported as `@adventure-llm/nl-glue/interpret-cache` so the main package entry stays browser-safe
 * (no `node:crypto` in the esbuild graph for cognition bundles).
 */
export * from "./interpretCacheKeyMaterial.js";
export * from "./interpretCacheKey.js";
//# sourceMappingURL=interpretCache.d.ts.map