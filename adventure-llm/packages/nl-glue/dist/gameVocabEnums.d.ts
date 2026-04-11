import type { AdventureDatabase } from "./dat/types.js";
/**
 * All distinct five-character vocabulary entries from `adventure.dat` (ATAB), sorted.
 */
export declare function collectGameVocabTokens(db: AdventureDatabase): string[];
/**
 * Token list for language-model JSON enums: game vocabulary plus synthetic planner tokens.
 * Use the same list for primary and secondary so the model cannot invent words;
 * use game token `NULL` (when present in dat) or omit secondary where the API allows.
 */
export declare function vocabTokensForLlmEnums(db: AdventureDatabase): string[];
/**
 * OpenAI Chat Completions `response_format.json_schema.schema` (strict) for interpret JSON.
 * Requires nullable fields so every property appears in `required` per OpenAI structured outputs rules.
 */
export declare function openAiInterpretCommandJsonSchema(tokenEnum: readonly string[]): Record<string, unknown>;
/**
 * OpenAI Chat Completions `response_format.json_schema.schema` (strict) for autoplay planner JSON.
 */
export declare function openAiAutoplayPlannerJsonSchema(tokenEnum: readonly string[]): Record<string, unknown>;
//# sourceMappingURL=gameVocabEnums.d.ts.map