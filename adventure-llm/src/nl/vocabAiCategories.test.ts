import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import { collectGameVocabTokens } from "./gameVocabEnums.js";
import {
  formatAiGroupedVocabularyHint,
  loadAiVocabCategoriesForHint,
  pickWordsFromAiGroups,
  resolveAiVocabCategoriesPath,
} from "./vocabAiCategories.js";
import { buildVocabHint } from "./vocabHint.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("loadAiVocabCategoriesForHint", () => {
  const db = loadDatFile(datPath);
  let tmpDir: string;
  const prev = { ...process.env };

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "vocab-ai-"));
    process.env = { ...prev };
    delete process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE;
    delete process.env.ADVENTURE_LLM_VOCAB_AI_CATEGORIES;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns grouped data when JSON is valid and coverage is sufficient", () => {
    const jsonPath = path.join(tmpDir, "vc.json");
    const all = collectGameVocabTokens(db);
    const mid = Math.ceil(all.length / 2);
    writeFileSync(
      jsonPath,
      JSON.stringify({
        version: 1,
        groups: [
          {
            id: "a",
            title: "Test A",
            blurb: "Use as primary.",
            tokens: [...all.slice(0, mid), "NOTREAL"],
          },
          {
            id: "b",
            title: "Test B",
            blurb: "Use as secondary.",
            tokens: all.slice(mid),
          },
        ],
      }),
      "utf8",
    );
    const r = loadAiVocabCategoriesForHint(db, jsonPath);
    expect(r).not.toBeNull();
    const flat = r!.groups.flatMap((g) => g.tokens);
    expect(flat).not.toContain("NOTREAL");
    expect(new Set(flat).size).toBe(all.length);
  });

  it("pickWordsFromAiGroups respects maxWords across group order", () => {
    const groups = [
      {
        id: "1",
        title: "G1",
        blurb: "b",
        tokens: ["A", "B", "C"],
      },
      {
        id: "2",
        title: "G2",
        blurb: "b",
        tokens: ["D", "E"],
      },
    ];
    const p = pickWordsFromAiGroups(groups, 4);
    expect(p.map((g) => g.tokens.join("")).join("")).toBe("ABCD");
  });
});

describe("buildVocabHint with AI file", () => {
  const db = loadDatFile(datPath);
  let tmpDir: string;
  const prev = { ...process.env };

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "vocab-ai-"));
    process.env = { ...prev };
    process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE = path.join(
      tmpDir,
      "vc.json",
    );
    const all = collectGameVocabTokens(db);
    const mid = Math.ceil(all.length / 2);
    writeFileSync(
      process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE,
      JSON.stringify({
        version: 1,
        groups: [
          {
            id: "g1",
            title: "Group one",
            blurb: "Primary token for travel.",
            tokens: all.slice(0, mid),
          },
          {
            id: "g2",
            title: "Group two",
            blurb: "Objects and verbs.",
            tokens: all.slice(mid),
          },
        ],
      }),
      "utf8",
    );
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("prefers AI categorization intro when file loads", () => {
    const hint = buildVocabHint(db, 24, {
      grouped: true,
      structuredGroups: true,
      compact: true,
    });
    expect(hint).toMatch(/AI-categorized/i);
  });
});

describe("resolveAiVocabCategoriesPath", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("honors ADVENTURE_LLM_VOCAB_CATEGORIES_FILE", () => {
    process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE = "/tmp/custom.json";
    expect(resolveAiVocabCategoriesPath()).toBe("/tmp/custom.json");
  });
});

describe("formatAiGroupedVocabularyHint", () => {
  it("renders #### when structured", () => {
    const s = formatAiGroupedVocabularyHint(
      [
        {
          id: "x",
          title: "T",
          blurb: "B",
          tokens: ["A", "B"],
        },
      ],
      { structuredGroups: true, compact: true },
    );
    expect(s).toContain("#### T");
  });
});
