import { z } from "zod";
import type { AdventureDatabase } from "./dat/types.js";
declare const AI_VOCAB_FILE_SCHEMA_VERSION = 1;
declare const aiGroupSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    blurb: z.ZodString;
    tokens: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    blurb: string;
    tokens: string[];
}, {
    id: string;
    title: string;
    blurb: string;
    tokens: string[];
}>;
declare const aiVocabFileSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodNumber>;
    groups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        blurb: z.ZodString;
        tokens: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        blurb: string;
        tokens: string[];
    }, {
        id: string;
        title: string;
        blurb: string;
        tokens: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    groups: {
        id: string;
        title: string;
        blurb: string;
        tokens: string[];
    }[];
    version?: number | undefined;
}, {
    groups: {
        id: string;
        title: string;
        blurb: string;
        tokens: string[];
    }[];
    version?: number | undefined;
}>;
export type AiVocabCategoryGroup = z.infer<typeof aiGroupSchema>;
export type AiVocabCategoriesFile = z.infer<typeof aiVocabFileSchema>;
/** Five-letter ATAB-style normalization (matches collectGameVocabTokens). */
export declare function normalizeVocabToken(raw: string): string;
/**
 * Path to AI vocabulary JSON.
 * - `ADVENTURE_NL_VOCAB_CATEGORIES_FILE` — explicit file path.
 * - `ADVENTURE_NL_VOCAB_AI_CATEGORIES=1` — use `.cache/vocab-categories-ai.json` under `process.cwd()`.
 * - Otherwise, if that default path exists, it is used (opt-in by placing the generated file).
 */
export declare function resolveAiVocabCategoriesPath(): string | null;
export type ResolvedAiVocabGroups = {
    readonly groups: readonly AiVocabCategoryGroup[];
};
/**
 * Load and validate AI categorization JSON against current `adventure.dat` vocabulary.
 * Returns null if path unset, file missing, parse fails, or coverage is too low.
 */
export declare function loadAiVocabCategoriesForHint(db: AdventureDatabase, jsonPath: string): ResolvedAiVocabGroups | null;
export declare function tryLoadAiVocabCategoriesForHint(db: AdventureDatabase): ResolvedAiVocabGroups | null;
/** Take up to `maxWords` tokens in group order (AI order, then uncategorized last). */
export declare function pickWordsFromAiGroups(groups: readonly AiVocabCategoryGroup[], maxWords: number): AiVocabCategoryGroup[];
export declare function formatAiGroupedVocabularyHint(groups: readonly AiVocabCategoryGroup[], options: {
    structuredGroups: boolean;
    compact: boolean;
}): string;
export { AI_VOCAB_FILE_SCHEMA_VERSION, aiVocabFileSchema };
//# sourceMappingURL=vocabAiCategories.d.ts.map