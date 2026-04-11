/**
 * MLX / Python workers sometimes emit Python literals instead of JSON.
 * Rewrite only outside double-quoted regions (handles \" escapes).
 */
export declare function normalizePythonJsonLiteralsInJsonText(input: string): string;
/**
 * First `{`…`}` span with brace depth respecting JSON string rules.
 * A greedy `/\{[\s\S]*\}/` can swallow two concatenated objects and break JSON.parse.
 */
export declare function extractFirstBalancedJsonObject(input: string): string | null;
/**
 * Parse JSON from model output that may include markdown fences or prose.
 */
export declare function parseJsonObjectFromLlmText(text: string): unknown;
//# sourceMappingURL=jsonFromLlmText.d.ts.map