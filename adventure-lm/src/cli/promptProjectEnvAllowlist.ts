/**
 * Server-side allowlist for prompt-project `envAllowlist` overrides.
 * Values are applied to `process.env` on project activate (single-user dashboard assumption).
 */

/** Keys safe to toggle at runtime for prompt/autoplay behavior (no secrets, no paths). */
export const PROMPT_PROJECT_ENV_ALLOWLIST: ReadonlySet<string> = new Set([
  "ADVENTURE_LM_AUTOPLAY_PROMPT_MODE",
  "ADVENTURE_LM_COMPACT_PROMPTS",
  "ADVENTURE_LM_STRUCTURED_PROMPTS",
  "ADVENTURE_LM_FAST_INTERPRET",
  "ADVENTURE_LM_INTERPRET_PROMPT_EXAMPLES",
  "ADVENTURE_LM_AUTOPLAY_TWO_STEP",
  "ADVENTURE_LM_DIAGONAL_COMPASS_MOTION",
  "ADVENTURE_LM_MLX_SYSTEM_VARIANT",
  "ADVENTURE_LM_VOCAB_HINT_MAX",
]);

export function sanitizePromptProjectEnvAllowlist(
  raw: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  if (raw === undefined) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!PROMPT_PROJECT_ENV_ALLOWLIST.has(k)) continue;
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length === 0) continue;
    out[k] = t.slice(0, 256);
  }
  return out;
}

export type EnvBackup = ReadonlyMap<string, string | undefined>;

/** Apply allowlisted env; returns backup of previous values for touched keys. */
export function applyAllowlistedEnvToProcess(
  allowlist: Readonly<Record<string, string>>,
): EnvBackup {
  const backup = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(allowlist)) {
    if (!PROMPT_PROJECT_ENV_ALLOWLIST.has(k)) continue;
    if (!backup.has(k)) backup.set(k, process.env[k]);
    process.env[k] = v;
  }
  return backup;
}

export function mergeEnvAllowlists(
  ...layers: readonly Readonly<Record<string, string>>[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const layer of layers) {
    Object.assign(out, sanitizePromptProjectEnvAllowlist(layer));
  }
  return out;
}

export function restoreEnvFromBackup(backup: EnvBackup): void {
  for (const [k, prev] of backup) {
    if (prev === undefined) delete process.env[k];
    else process.env[k] = prev;
  }
}
