/**
 * MLX / Python workers sometimes emit Python literals instead of JSON.
 * Rewrite only outside double-quoted regions (handles \" escapes).
 */
export function normalizePythonJsonLiteralsInJsonText(input) {
    const keywords = [
        { pat: /^None\b/, rep: "null" },
        { pat: /^True\b/, rep: "true" },
        { pat: /^False\b/, rep: "false" },
    ];
    let out = "";
    let i = 0;
    let inString = false;
    let escape = false;
    while (i < input.length) {
        const c = input[i];
        if (inString) {
            out += c;
            if (escape) {
                escape = false;
            }
            else if (c === "\\") {
                escape = true;
            }
            else if (c === '"') {
                inString = false;
            }
            i += 1;
            continue;
        }
        if (c === '"') {
            inString = true;
            out += c;
            i += 1;
            continue;
        }
        const slice = input.slice(i);
        let replaced = false;
        for (const { pat, rep } of keywords) {
            const m = pat.exec(slice);
            if (m) {
                out += rep;
                i += m[0].length;
                replaced = true;
                break;
            }
        }
        if (replaced) {
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}
/**
 * Small models sometimes omit the colon after a quoted key, e.g.
 * `{"continuePlaying" true}` → JSON.parse expects ':' after the property name.
 */
function insertMissingColonsAfterQuotedKeys(input) {
    let s = input;
    s = s.replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*(true|false|null)\b/g, '"$1": $2');
    s = s.replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '"$1": $2');
    s = s.replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*([{[])/g, '"$1": $2');
    s = s.replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s+"/g, '"$1": "');
    return s;
}
/**
 * First `{`…`}` span with brace depth respecting JSON string rules.
 * A greedy `/\{[\s\S]*\}/` can swallow two concatenated objects and break JSON.parse.
 */
export function extractFirstBalancedJsonObject(input) {
    const start = input.indexOf("{");
    if (start < 0)
        return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < input.length; i++) {
        const c = input[i];
        if (inString) {
            if (escape) {
                escape = false;
            }
            else if (c === "\\") {
                escape = true;
            }
            else if (c === '"') {
                inString = false;
            }
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === "{") {
            depth += 1;
        }
        else if (c === "}") {
            depth -= 1;
            if (depth === 0) {
                return input.slice(start, i + 1);
            }
        }
    }
    return null;
}
/**
 * Parse JSON from model output that may include markdown fences or prose.
 */
export function parseJsonObjectFromLlmText(text) {
    const trimmed = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
    const jsonStr = fence ? fence[1].trim() : trimmed;
    const balanced = extractFirstBalancedJsonObject(jsonStr);
    const toParse = balanced ?? jsonStr;
    const withColons = insertMissingColonsAfterQuotedKeys(toParse);
    const normalized = normalizePythonJsonLiteralsInJsonText(withColons);
    return JSON.parse(normalized);
}
//# sourceMappingURL=jsonFromLlmText.js.map