import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInterpretEvalExamplesSection, loadInterpretEvalFixtures, } from "@adventure-llm/nl-glue";
const repoFixturesPath = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../../scripts/interpret-eval-fixtures.json");
describe("loadInterpretEvalFixtures", () => {
    it("loads and parses the repo fixtures file", () => {
        const fixtures = loadInterpretEvalFixtures(repoFixturesPath);
        expect(fixtures.length).toBeGreaterThan(0);
        const motion = fixtures.find((f) => f.id === "motion-east");
        expect(motion?.expect.primaryToken).toBe("EAST");
    });
});
describe("buildInterpretEvalExamplesSection", () => {
    const sample = loadInterpretEvalFixtures(repoFixturesPath);
    it("returns empty when all fixtures opt out of prompt", () => {
        const onlyOut = sample.map((f) => ({ ...f, includeInPrompt: false }));
        expect(buildInterpretEvalExamplesSection(onlyOut, {
            structuredDashboard: true,
        })).toBe("");
    });
    it("uses ### EXAMPLES when structured", () => {
        const text = buildInterpretEvalExamplesSection([{ ...sample[0], includeInPrompt: true }], { structuredDashboard: true });
        expect(text.startsWith("### EXAMPLES")).toBe(true);
        expect(text).toContain("go east");
        expect(text).toContain("Reply:");
    });
    it("omits fixtures with includeInPrompt false", () => {
        const withHidden = sample;
        const text = buildInterpretEvalExamplesSection(withHidden, {
            structuredDashboard: false,
        });
        expect(text).not.toMatch(/pick them up/i);
    });
});
//# sourceMappingURL=interpretEvalFixtures.test.js.map