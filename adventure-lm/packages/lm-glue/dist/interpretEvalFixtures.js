import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeInterpretEvalToken } from "./interpretEvalMatch.js";
const interpretEvalExpectSchema = z.object({
    primaryToken: z.string(),
    secondaryToken: z.string().optional(),
    primaryAlternates: z.array(z.string()).optional(),
});
const interpretEvalFixtureSchema = z.object({
    id: z.string(),
    userText: z.string(),
    recentGameText: z.string().optional(),
    expect: interpretEvalExpectSchema,
    /** When false, fixture is evaluated but omitted from optional prompt EXAMPLES block. */
    includeInPrompt: z.boolean().optional(),
});
const interpretEvalFileSchema = z.array(interpretEvalFixtureSchema);
function defaultFixturesPath() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "../fixtures/interpret-eval-fixtures.json");
}
/**
 * Load interpret eval fixtures from `packages/lm-glue/fixtures/interpret-eval-fixtures.json` by default.
 * Throws if the file is missing or invalid JSON/schema.
 */
export function loadInterpretEvalFixtures(jsonPath = defaultFixturesPath()) {
    const raw = readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    return interpretEvalFileSchema.parse(parsed);
}
/**
 * Build a user-facing EXAMPLES block from fixtures (expected JSON only; for few-shot tuning).
 */
export function buildInterpretEvalExamplesSection(fixtures, options) {
    const rows = fixtures.filter((f) => f.includeInPrompt !== false);
    if (rows.length === 0)
        return "";
    const header = options.structuredDashboard
        ? "### EXAMPLES"
        : "## EXAMPLES (same JSON shape as your reply)";
    const lines = [header, ""];
    for (const f of rows) {
        const obj = {
            primaryToken: normalizeInterpretEvalToken(f.expect.primaryToken),
        };
        if (f.expect.secondaryToken !== undefined &&
            f.expect.secondaryToken.trim() !== "") {
            obj.secondaryToken = normalizeInterpretEvalToken(f.expect.secondaryToken);
        }
        lines.push(`User: ${f.userText}`);
        if (f.recentGameText !== undefined && f.recentGameText.trim() !== "") {
            lines.push(`Recent game output:\n---\n${f.recentGameText.trim()}\n---`);
        }
        lines.push(`Reply: ${JSON.stringify(obj)}`);
        lines.push("");
    }
    return lines.join("\n").trimEnd();
}
//# sourceMappingURL=interpretEvalFixtures.js.map