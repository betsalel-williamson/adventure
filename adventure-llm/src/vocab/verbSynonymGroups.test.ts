import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import { buildVerbSynonymGroups } from "@adventure-llm/nl-glue";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const datPath = path.join(repoRoot, "..", "adventure.dat");

describe("buildVerbSynonymGroups", () => {
  it("groups TAKE with GET and other synonyms from adventure.dat", () => {
    const db = loadDatFile(datPath);
    const groups = buildVerbSynonymGroups(db);
    const takeGroup = groups.find((g) => g.tokens.includes("TAKE"));
    expect(takeGroup).toBeDefined();
    expect(takeGroup!.tokens).toContain("GET");
    expect(takeGroup!.tokens.length).toBeGreaterThan(2);
  });

  it("returns sorted groups with sorted tokens", () => {
    const db = loadDatFile(datPath);
    const groups = buildVerbSynonymGroups(db);
    expect(groups.length).toBeGreaterThan(0);
    for (let i = 1; i < groups.length; i++) {
      expect(
        groups[i]!.tokens[0]!.localeCompare(groups[i - 1]!.tokens[0]!),
      ).toBeGreaterThanOrEqual(0);
    }
    for (const g of groups) {
      const sorted = [...g.tokens].sort((a, b) => a.localeCompare(b));
      expect(g.tokens).toEqual(sorted);
    }
  });
});
