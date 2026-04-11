import type { InterpretedCommand } from "./schema.js";
/** Normalize a parser token the same way GETIN columns use five-letter words. */
export declare function normalizeInterpretEvalToken(raw: string): string;
export type InterpretEvalExpect = {
    readonly primaryToken: string;
    readonly secondaryToken?: string;
    /** Other accepted primaries after normalization (e.g. GET vs TAKE for the same object). */
    readonly primaryAlternates?: readonly string[];
};
export type InterpretEvalComparison = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly primaryMatch: boolean;
    readonly secondaryMatch: boolean;
    readonly got: {
        readonly primaryToken: string;
        readonly secondaryToken?: string;
    };
    readonly want: InterpretEvalExpect;
};
/**
 * Compare model interpretation to expected tokens (case-insensitive, five-letter trim).
 * If `expect` has no secondary, `actual` must have no secondary (empty or undefined).
 */
export declare function compareInterpretEval(actual: InterpretedCommand, expect_: InterpretEvalExpect): InterpretEvalComparison;
//# sourceMappingURL=interpretEvalMatch.d.ts.map