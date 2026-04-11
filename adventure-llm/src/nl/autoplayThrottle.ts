/**
 * Pace / max-moves / context window for autoplay — safe to import from browser bundles (ADR0005).
 */

export type AutoplayPaceOverrides = {
  readonly paceMs?: number;
  readonly maxMoves?: number;
  readonly getPaceMs?: () => number;
  readonly getMaxMoves?: () => number;
};

const PACE_MS_MAX = 3_600_000;
const MAX_MOVES_CAP = 1_000_000;

function envString(key: string): string | undefined {
  if (typeof process === "undefined" || process.env === undefined)
    return undefined;
  return process.env[key]?.trim();
}

export function resolveAutoplayPaceMs(): number {
  const v = envString("ADVENTURE_LLM_AUTOPLAY_PACE_MS");
  if (v === undefined || v === "") return 2000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}

/** Default cap when `ADVENTURE_LLM_AUTOPLAY_MAX_MOVES` is unset (benchmark-friendly). */
export const DEFAULT_AUTOPLAY_MAX_MOVES = 120;

export function resolveAutoplayMaxMoves(): number {
  const v = envString("ADVENTURE_LLM_AUTOPLAY_MAX_MOVES");
  if (v === undefined || v === "") return DEFAULT_AUTOPLAY_MAX_MOVES;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1
    ? Math.floor(n)
    : DEFAULT_AUTOPLAY_MAX_MOVES;
}

export function resolveAutoplayContextChars(): number {
  const v = envString("ADVENTURE_LLM_AUTOPLAY_CONTEXT_CHARS");
  if (v === undefined || v === "") return 6000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 2000 ? Math.floor(n) : 6000;
}

export function paceMsFromOverrides(
  overrides: AutoplayPaceOverrides | undefined,
): number {
  if (overrides?.getPaceMs) {
    const n = overrides.getPaceMs();
    if (Number.isFinite(n) && n >= 0 && n <= PACE_MS_MAX) return Math.floor(n);
    return resolveAutoplayPaceMs();
  }
  if (overrides?.paceMs !== undefined) {
    const n = Number(overrides.paceMs);
    return Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : resolveAutoplayPaceMs();
  }
  return resolveAutoplayPaceMs();
}

export function maxMovesFromOverrides(
  overrides: AutoplayPaceOverrides | undefined,
): number {
  if (overrides?.getMaxMoves) {
    const n = overrides.getMaxMoves();
    if (Number.isFinite(n) && n >= 1 && n <= MAX_MOVES_CAP)
      return Math.floor(n);
    return resolveAutoplayMaxMoves();
  }
  if (overrides?.maxMoves !== undefined) {
    const n = Number(overrides.maxMoves);
    return Number.isFinite(n)
      ? Math.max(1, Math.floor(n))
      : resolveAutoplayMaxMoves();
  }
  return resolveAutoplayMaxMoves();
}
