import { createHash } from "node:crypto";

/** Default schema version for interpret disk cache; bump when key material meaning changes. */
export const DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION = "2";

/**
 * Effective interpret cache schema version (`ADVENTURE_NL_CACHE_SCHEMA_VERSION` or default).
 */
export function interpretCacheSchemaVersion(): string {
  const v = process.env.ADVENTURE_NL_CACHE_SCHEMA_VERSION?.trim();
  return v && v.length > 0 ? v : DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION;
}

/**
 * Hash for interpret cache entries: version, provider, model, user line, prompt layout, recent-game slice.
 */
export function interpretCacheKeyMaterialHash(
  parts: readonly string[],
): string {
  return createHash("sha256")
    .update(
      ["interpret", interpretCacheSchemaVersion(), ...parts].join("\u001e"),
      "utf8",
    )
    .digest("hex");
}
