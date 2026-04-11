/**
 * Normalize structured language-model JSON before Zod validation. Small local models often return
 * over-long tokens, JSON null for optional fields, or non-boolean continuePlaying.
 */
/** Coerce fields for {@link InterpretedCommandSchema} / autoplay. */
export declare function coerceInterpretedCommandJson(raw: unknown): unknown;
/** Same as interpret plus {@link AutoplayPlannerResponseSchema} `continuePlaying`. */
export declare function coerceAutoplayPlannerJson(raw: unknown): unknown;
//# sourceMappingURL=coerceLlmJson.d.ts.map