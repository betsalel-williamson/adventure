import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDatFile } from "../dat/loadDat.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAutoplayPlannerPrompt,
  buildInterpretSystemAndUserPrompt,
  linesForAutoplayPlannerContextBody,
  resolveCompactPrompts,
  resolveVocabHintMaxWords,
} from "./adventureNlPrompts.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("resolveCompactPrompts", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_COMPACT_PROMPTS;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("defaults mlx on and google off", () => {
    expect(resolveCompactPrompts("mlx")).toBe(true);
    expect(resolveCompactPrompts("google")).toBe(false);
    expect(resolveCompactPrompts("http")).toBe(false);
  });

  it("respects ADVENTURE_LLM_COMPACT_PROMPTS=0 and =1", () => {
    process.env.ADVENTURE_LLM_COMPACT_PROMPTS = "0";
    expect(resolveCompactPrompts("mlx")).toBe(false);
    process.env.ADVENTURE_LLM_COMPACT_PROMPTS = "1";
    expect(resolveCompactPrompts("google")).toBe(true);
  });
});

describe("resolveVocabHintMaxWords", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses fewer words when compact and env unset", () => {
    delete process.env.ADVENTURE_LLM_VOCAB_HINT_MAX;
    expect(resolveVocabHintMaxWords(true)).toBe(48);
    expect(resolveVocabHintMaxWords(false)).toBe(120);
  });

  it("respects ADVENTURE_LLM_VOCAB_HINT_MAX", () => {
    process.env.ADVENTURE_LLM_VOCAB_HINT_MAX = "64";
    expect(resolveVocabHintMaxWords(false)).toBe(64);
    expect(resolveVocabHintMaxWords(true)).toBe(64);
  });
});

describe("compact NL prompts", () => {
  const db = loadDatFile(datPath);

  it("compact interpret prompt omits HELP block and is shorter than full", () => {
    const full = buildInterpretSystemAndUserPrompt(
      db,
      "go east",
      "ROOM TEXT",
      {},
    );
    const compact = buildInterpretSystemAndUserPrompt(
      db,
      "go east",
      "ROOM TEXT",
      {
        compact: true,
      },
    );
    expect(compact.length).toBeLessThan(full.length);
    expect(full).toMatch(/RTEXT|Official in-game HELP/i);
    expect(compact).not.toMatch(/Official in-game HELP text/);
    expect(compact).toContain("JSON");
  });

  it("compact autoplay planner prompt omits HELP preamble", () => {
    const body = "vocab section only";
    const full = buildAutoplayPlannerPrompt(db, body, {});
    const compact = buildAutoplayPlannerPrompt(db, body, { compact: true });
    expect(full).toMatch(/adventure\.dat RTEXT|Official in-game HELP/i);
    expect(compact).not.toMatch(/Official in-game HELP/);
    expect(compact.startsWith(body)).toBe(true);
  });

  it("linesForAutoplayPlannerContextBody compact uses short role", () => {
    const lines = linesForAutoplayPlannerContextBody("EAST, WEST", {
      compact: true,
    });
    expect(lines[0]).toContain("adventurer");
    expect(lines.join("\n")).toContain("TAKE or GET");
  });
});
