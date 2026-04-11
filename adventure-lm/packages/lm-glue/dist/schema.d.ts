import { z } from "zod";
/** Gemini / NL layer output before GETIN normalization. */
export declare const InterpretedCommandSchema: z.ZodObject<{
    primaryToken: z.ZodString;
    secondaryToken: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    primaryToken: string;
    secondaryToken?: string | undefined;
    confidence?: number | undefined;
}, {
    primaryToken: string;
    secondaryToken?: string | undefined;
    confidence?: number | undefined;
}>;
export type InterpretedCommand = z.infer<typeof InterpretedCommandSchema>;
/** Autoplay planner: same tokens plus optional stop signal. */
export declare const AutoplayPlannerResponseSchema: z.ZodObject<{
    primaryToken: z.ZodString;
    secondaryToken: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
} & {
    /** When false, the session ends after this response (no further GETIN). */
    continuePlaying: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    primaryToken: string;
    secondaryToken?: string | undefined;
    confidence?: number | undefined;
    continuePlaying?: boolean | undefined;
}, {
    primaryToken: string;
    secondaryToken?: string | undefined;
    confidence?: number | undefined;
    continuePlaying?: boolean | undefined;
}>;
export type AutoplayPlannerResponse = z.infer<typeof AutoplayPlannerResponseSchema>;
/** Build a single GETIN line from interpreted tokens (two words in first ten columns). */
export declare function interpretedToGetinLine(cmd: InterpretedCommand): string;
/**
 * Second GETIN attempt when the first line is rejected: swap verb and object slots.
 * Some NL maps put the object in `primaryToken` and the verb in `secondaryToken`.
 */
export declare function swapInterpretedTokens(cmd: InterpretedCommand): InterpretedCommand | null;
//# sourceMappingURL=schema.d.ts.map