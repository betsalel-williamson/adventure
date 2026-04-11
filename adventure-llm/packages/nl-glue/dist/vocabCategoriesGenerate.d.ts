import type { AdventureDatabase } from "./dat/types.js";
import { type AiVocabCategoriesFile } from "./vocabAiCategories.js";
import type { TextLlm } from "./textLlmContract.js";
export declare function buildVocabAiCategorizationPrompt(tokens: readonly string[]): string;
/**
 * Call the configured text model once to build an {@link AiVocabCategoriesFile} and validate shape.
 * Caller writes the result to disk; see \`scripts/generate-vocab-categories-ai.mjs\`.
 */
export declare function generateAiVocabCategoriesWithLlm(db: AdventureDatabase, client: TextLlm, options?: {
    tokenLimit?: number;
}): Promise<AiVocabCategoriesFile>;
//# sourceMappingURL=vocabCategoriesGenerate.d.ts.map