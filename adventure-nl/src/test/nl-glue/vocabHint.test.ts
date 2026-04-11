import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../../dat/loadDat.js";
import { buildVocabHint } from "@adventure-nl/nl-glue";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../adventure.dat",
);

describe("buildVocabHint", () => {
  const db = loadDatFile(datPath);
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.ADVENTURE_NL_VOCAB_CATEGORIES_FILE = path.join(
      tmpdir(),
      `no-ai-vocab-${Date.now()}.json`,
    );
    delete process.env.ADVENTURE_NL_VOCAB_AI_CATEGORIES;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("legacy flat mode matches table-order comma list", () => {
    const legacy = buildVocabHint(db, 20, { grouped: false });
    const words = legacy.split(", ");
    expect(words.length).toBe(20);
    expect(legacy).not.toMatch(/Motion|travel|verbs/i);
  });

  it("grouped structured layout uses #### sections and guidance blurbs", () => {
    const g = buildVocabHint(db, 40, {
      grouped: true,
      structuredGroups: true,
      compact: false,
    });
    expect(g).toMatch(/#### Motion/i);
    expect(g).toMatch(/primaryToken/i);
    expect(g).toMatch(/ROAD|EAST|ENTER/i);
  });

  it("grouped compact uses shorter blurbs", () => {
    const g = buildVocabHint(db, 30, {
      grouped: true,
      structuredGroups: false,
      compact: true,
    });
    expect(g).toMatch(/\*\*Motion/i);
    expect(g.length).toBeLessThan(
      buildVocabHint(db, 30, {
        grouped: true,
        structuredGroups: false,
        compact: false,
      }).length,
    );
  });

  it("larger maxWords yields longer grouped hint (more tokens)", () => {
    const small = buildVocabHint(db, 12, {
      grouped: true,
      structuredGroups: true,
      compact: true,
    });
    const large = buildVocabHint(db, 80, {
      grouped: true,
      structuredGroups: true,
      compact: true,
    });
    expect(small.length).toBeLessThan(large.length);
  });
});
