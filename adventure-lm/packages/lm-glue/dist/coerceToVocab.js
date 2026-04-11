import { vocabTokensForLlmEnums } from "./gameVocabEnums.js";
import { toA5 } from "./vocab/vocab.js";
/** When no vocabulary match is found for the primary slot (matches {@link coerceLlmJson}). */
const PRIMARY_FALLBACK = "EAST";
function allowedTokenSet(db) {
    return new Set(vocabTokensForLlmEnums(db));
}
/**
 * Map a raw string to a single ATAB vocabulary token (or synthetic QUIT), using prefix
 * shortening so e.g. `BUILDING` → `BUILD` when `BUILD` is in the dictionary.
 */
export function coercePrimaryTokenToVocab(db, raw) {
    return snapToVocab(raw, allowedTokenSet(db), PRIMARY_FALLBACK);
}
/**
 * Map optional second word to a vocabulary token, or `undefined` if it cannot be matched.
 */
export function coerceSecondaryTokenToVocab(db, raw) {
    if (raw === undefined)
        return undefined;
    const allowed = allowedTokenSet(db);
    const snapped = snapToVocabOptional(raw, allowed);
    return snapped;
}
/**
 * Receive-side coercion: every token is either a known game word (after prefix / pad
 * matching) or replaced (primary → {@link PRIMARY_FALLBACK}, secondary dropped).
 */
export function coerceInterpretedCommandToVocab(db, cmd) {
    const allowed = allowedTokenSet(db);
    const primary = snapToVocab(cmd.primaryToken, allowed, PRIMARY_FALLBACK);
    let secondary = snapToVocabOptional(cmd.secondaryToken, allowed);
    if (secondary !== undefined && secondary === primary) {
        secondary = undefined;
    }
    return {
        primaryToken: primary,
        secondaryToken: secondary,
        confidence: cmd.confidence,
    };
}
/** Same as {@link coerceInterpretedCommandToVocab} for autoplay; preserves `continuePlaying`. */
export function coerceAutoplayPlannerToVocab(db, r) {
    const base = coerceInterpretedCommandToVocab(db, r);
    return {
        ...base,
        continuePlaying: r.continuePlaying,
    };
}
function snapToVocab(raw, allowed, fallback) {
    const opt = snapToVocabOptional(raw, allowed);
    return opt ?? fallback;
}
function snapToVocabOptional(raw, allowed) {
    if (raw === undefined)
        return undefined;
    const letters = String(raw)
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
    if (letters.length === 0)
        return undefined;
    const candidate = letters.slice(0, 5);
    if (allowed.has(candidate))
        return candidate;
    for (let len = Math.min(5, candidate.length); len >= 1; len--) {
        const prefix = candidate.slice(0, len);
        if (allowed.has(prefix))
            return prefix;
    }
    const padded = toA5(letters);
    for (const w of allowed) {
        if (toA5(w) === padded)
            return w;
    }
    return undefined;
}
//# sourceMappingURL=coerceToVocab.js.map