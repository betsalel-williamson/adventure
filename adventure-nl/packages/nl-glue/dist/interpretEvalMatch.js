/** Normalize a parser token the same way GETIN columns use five-letter words. */
export function normalizeInterpretEvalToken(raw) {
    return raw.trim().toUpperCase().slice(0, 5);
}
/**
 * Compare model interpretation to expected tokens (case-insensitive, five-letter trim).
 * If `expect` has no secondary, `actual` must have no secondary (empty or undefined).
 */
export function compareInterpretEval(actual, expect_) {
    const gotPrimary = normalizeInterpretEvalToken(actual.primaryToken);
    const wantPrimary = normalizeInterpretEvalToken(expect_.primaryToken);
    const altPrimaries = (expect_.primaryAlternates ?? []).map(normalizeInterpretEvalToken);
    const primaryMatch = gotPrimary === wantPrimary || altPrimaries.includes(gotPrimary);
    const wantSecRaw = expect_.secondaryToken?.trim();
    const wantSecondary = wantSecRaw !== undefined && wantSecRaw !== ""
        ? normalizeInterpretEvalToken(wantSecRaw)
        : undefined;
    const actSecRaw = actual.secondaryToken?.trim();
    const gotSecondary = actSecRaw !== undefined && actSecRaw !== ""
        ? normalizeInterpretEvalToken(actSecRaw)
        : undefined;
    let secondaryMatch;
    if (wantSecondary === undefined) {
        secondaryMatch = gotSecondary === undefined;
    }
    else {
        secondaryMatch = gotSecondary === wantSecondary;
    }
    if (primaryMatch && secondaryMatch)
        return { ok: true };
    return {
        ok: false,
        primaryMatch,
        secondaryMatch,
        got: {
            primaryToken: gotPrimary,
            ...(gotSecondary !== undefined ? { secondaryToken: gotSecondary } : {}),
        },
        want: expect_,
    };
}
//# sourceMappingURL=interpretEvalMatch.js.map