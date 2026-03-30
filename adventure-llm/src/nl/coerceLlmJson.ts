/**
 * Normalize structured language-model JSON before Zod validation. Small local models often return
 * over-long tokens, JSON null for optional fields, or non-boolean continuePlaying.
 */

const PRIMARY_FALLBACK = "EAST";

function coercePrimaryToken(v: unknown): string {
  if (v === null || v === undefined) return PRIMARY_FALLBACK;
  const s = String(v).trim().toUpperCase();
  const first = s.split(/\s+/)[0] ?? "";
  const letters = first.replace(/[^A-Z]/g, "");
  const t = letters.slice(0, 5);
  return t.length > 0 ? t : PRIMARY_FALLBACK;
}

function coerceSecondaryToken(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim().toUpperCase();
  if (s === "" || s === "NULL" || s === "NONE" || s === "N/A") return undefined;
  const first = s.split(/\s+/)[0] ?? "";
  const letters = first.replace(/[^A-Z]/g, "");
  const t = letters.slice(0, 5);
  return t.length > 0 ? t : undefined;
}

function coerceConfidence(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const c = Number(v);
  if (!Number.isFinite(c)) return undefined;
  return Math.max(0, Math.min(1, c));
}

/** Coerce fields for {@link InterpretedCommandSchema} / autoplay. */
export function coerceInterpretedCommandJson(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  o.primaryToken = coercePrimaryToken(o.primaryToken);
  if ("secondaryToken" in o) {
    if (o.secondaryToken === null || o.secondaryToken === undefined) {
      delete o.secondaryToken;
    } else {
      const sec = coerceSecondaryToken(o.secondaryToken);
      if (sec === undefined) delete o.secondaryToken;
      else o.secondaryToken = sec;
    }
  }
  if ("confidence" in o) {
    const c = coerceConfidence(o.confidence);
    if (c === undefined) delete o.confidence;
    else o.confidence = c;
  }
  return o;
}

/** Same as interpret plus {@link AutoplayPlannerResponseSchema} `continuePlaying`. */
export function coerceAutoplayPlannerJson(raw: unknown): unknown {
  const base = coerceInterpretedCommandJson(raw);
  if (base === null || typeof base !== "object" || Array.isArray(base))
    return base;
  const o = base as Record<string, unknown>;
  if ("continuePlaying" in o) {
    const v = o.continuePlaying;
    if (v === null || v === undefined) {
      delete o.continuePlaying;
    } else if (typeof v === "boolean") {
      /* keep */
    } else if (v === "false" || v === 0) {
      o.continuePlaying = false;
    } else if (v === "true" || v === 1) {
      o.continuePlaying = true;
    } else {
      delete o.continuePlaying;
    }
  }
  return o;
}
