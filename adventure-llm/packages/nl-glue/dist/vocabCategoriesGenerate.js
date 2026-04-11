import { collectGameVocabTokens } from "./gameVocabEnums.js";
import { AI_VOCAB_FILE_SCHEMA_VERSION, aiVocabFileSchema, normalizeVocabToken, } from "./vocabAiCategories.js";
import { parseJsonObjectFromLlmText } from "./jsonFromLlmText.js";
export function buildVocabAiCategorizationPrompt(tokens) {
    const list = [...tokens].sort((a, b) => a.localeCompare(b)).join(",");
    return `You are helping document Colossal Cave Adventure parser vocabulary (GETIN five-letter words from ATAB).

TASK: Group EVERY token below for natural-language → JSON command mapping. Each token must appear exactly once across all groups.

Rules:
- Use ONLY the exact spellings given (five letters each as shown). Do not invent tokens or alter spelling.
- Order tokens within each group from most useful for a player command to least (your judgment).
- Suggest 4–8 groups. Typical themes: directions and movement; actions/verbs (TAKE, OPEN, …); objects and nouns (KEYS, LAMP, …); meta (HELP, QUIT, …). Merge rare themes if needed.
- title and blurb are concise English. blurb is one or two sentences on when to use these as primaryToken vs secondaryToken.

Reply with ONE JSON object only. No markdown code fences. No other text.

Schema:
{"version":${AI_VOCAB_FILE_SCHEMA_VERSION},"groups":[{"id":"string","title":"string","blurb":"string","tokens":["WORD",...]},...]}

Tokens (${tokens.length} total, comma-separated):
${list}`;
}
/**
 * Call the configured text model once to build an {@link AiVocabCategoriesFile} and validate shape.
 * Caller writes the result to disk; see \`scripts/generate-vocab-categories-ai.mjs\`.
 */
export async function generateAiVocabCategoriesWithLlm(db, client, options) {
    let tokens = collectGameVocabTokens(db);
    const limit = options?.tokenLimit ?? 512;
    if (tokens.length > limit) {
        tokens = tokens.slice(0, limit);
    }
    const prompt = buildVocabAiCategorizationPrompt(tokens);
    const raw = await client.generateUnstructured(prompt);
    const parsedUnknown = parseJsonObjectFromLlmText(raw);
    const parsed = aiVocabFileSchema.safeParse(parsedUnknown);
    if (!parsed.success) {
        throw new Error(`vocab AI categorization: invalid JSON from model: ${parsed.error.message}`);
    }
    const allowed = new Set(collectGameVocabTokens(db));
    const seen = new Set();
    const groups = parsed.data.groups.map((g) => {
        const tok = [];
        for (const t of g.tokens) {
            const n = normalizeVocabToken(t);
            if (!allowed.has(n) || seen.has(n))
                continue;
            seen.add(n);
            tok.push(n);
        }
        return {
            id: g.id.trim() || "group",
            title: g.title.trim(),
            blurb: g.blurb.trim(),
            tokens: tok,
        };
    });
    const filtered = groups.filter((g) => g.tokens.length > 0);
    const missing = [...allowed].filter((w) => !seen.has(w)).sort();
    if (missing.length > 0) {
        filtered.push({
            id: "uncategorized",
            title: "Remaining parser tokens",
            blurb: "Automatically added: tokens the model omitted but the game table includes.",
            tokens: missing,
        });
    }
    return {
        version: AI_VOCAB_FILE_SCHEMA_VERSION,
        groups: filtered,
    };
}
//# sourceMappingURL=vocabCategoriesGenerate.js.map