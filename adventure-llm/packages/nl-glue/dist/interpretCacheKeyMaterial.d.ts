/** Default schema version for interpret disk cache; bump when key material meaning changes. */
export declare const DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION = "2";
/**
 * Effective interpret cache schema version (`ADVENTURE_LLM_CACHE_SCHEMA_VERSION` or default).
 */
export declare function interpretCacheSchemaVersion(): string;
/**
 * Hash for interpret cache entries: version, provider, model, user line, prompt layout, recent-game slice.
 */
export declare function interpretCacheKeyMaterialHash(parts: readonly string[]): string;
//# sourceMappingURL=interpretCacheKeyMaterial.d.ts.map