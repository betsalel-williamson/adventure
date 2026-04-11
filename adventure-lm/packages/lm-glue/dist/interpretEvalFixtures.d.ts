import { z } from "zod";
declare const interpretEvalFixtureSchema: z.ZodObject<{
    id: z.ZodString;
    userText: z.ZodString;
    recentGameText: z.ZodOptional<z.ZodString>;
    expect: z.ZodObject<{
        primaryToken: z.ZodString;
        secondaryToken: z.ZodOptional<z.ZodString>;
        primaryAlternates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        primaryToken: string;
        secondaryToken?: string | undefined;
        primaryAlternates?: string[] | undefined;
    }, {
        primaryToken: string;
        secondaryToken?: string | undefined;
        primaryAlternates?: string[] | undefined;
    }>;
    /** When false, fixture is evaluated but omitted from optional prompt EXAMPLES block. */
    includeInPrompt: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    userText: string;
    expect: {
        primaryToken: string;
        secondaryToken?: string | undefined;
        primaryAlternates?: string[] | undefined;
    };
    recentGameText?: string | undefined;
    includeInPrompt?: boolean | undefined;
}, {
    id: string;
    userText: string;
    expect: {
        primaryToken: string;
        secondaryToken?: string | undefined;
        primaryAlternates?: string[] | undefined;
    };
    recentGameText?: string | undefined;
    includeInPrompt?: boolean | undefined;
}>;
export type InterpretEvalFixture = z.infer<typeof interpretEvalFixtureSchema>;
/**
 * Load interpret eval fixtures from `packages/lm-glue/fixtures/interpret-eval-fixtures.json` by default.
 * Throws if the file is missing or invalid JSON/schema.
 */
export declare function loadInterpretEvalFixtures(jsonPath?: string): InterpretEvalFixture[];
/**
 * Build a user-facing EXAMPLES block from fixtures (expected JSON only; for few-shot tuning).
 */
export declare function buildInterpretEvalExamplesSection(fixtures: readonly InterpretEvalFixture[], options: {
    readonly structuredDashboard: boolean;
}): string;
export {};
//# sourceMappingURL=interpretEvalFixtures.d.ts.map