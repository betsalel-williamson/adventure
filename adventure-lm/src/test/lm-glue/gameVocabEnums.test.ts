import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../../dat/loadDat.js";
import {
  collectGameVocabTokens,
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "@adventure-lm/lm-glue";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../adventure.dat",
);

describe("gameVocabEnums", () => {
  it("collects many ATAB tokens from adventure.dat", () => {
    const db = loadDatFile(datPath);
    const w = collectGameVocabTokens(db);
    expect(w.length).toBeGreaterThan(80);
    expect(w).toContain("EAST");
    expect(w).toContain("BUILD");
    expect(w).toContain("KEYS");
  });

  it("adds QUIT for planner enums and omits diagonal compass motion by default", () => {
    const db = loadDatFile(datPath);
    const full = collectGameVocabTokens(db);
    const w = vocabTokensForLlmEnums(db);
    expect(w).toContain("QUIT");
    expect(w).not.toContain("NE");
    expect(w).not.toContain("NW");
    expect(w).not.toContain("SE");
    expect(w).not.toContain("SW");
    expect(w.length).toBe(full.length + 1 - 4);
  });

  it("includes diagonal compass motion in planner enums when ADVENTURE_LM_DIAGONAL_COMPASS_MOTION is set", () => {
    const prev = process.env.ADVENTURE_LM_DIAGONAL_COMPASS_MOTION;
    process.env.ADVENTURE_LM_DIAGONAL_COMPASS_MOTION = "1";
    try {
      const db = loadDatFile(datPath);
      const full = collectGameVocabTokens(db);
      const w = vocabTokensForLlmEnums(db);
      expect(w).toContain("NE");
      expect(w.length).toBe(full.length + 1);
    } finally {
      if (prev === undefined)
        delete process.env.ADVENTURE_LM_DIAGONAL_COMPASS_MOTION;
      else process.env.ADVENTURE_LM_DIAGONAL_COMPASS_MOTION = prev;
    }
  });

  it("OpenAI strict schemas reference only enum tokens", () => {
    const db = loadDatFile(datPath);
    const tokens = vocabTokensForLlmEnums(db);
    const interpret = openAiInterpretCommandJsonSchema(tokens);
    const autoplay = openAiAutoplayPlannerJsonSchema(tokens);
    expect(interpret.required).toEqual([
      "primaryToken",
      "secondaryToken",
      "confidence",
    ]);
    expect(autoplay.required).toContain("continuePlaying");
    const p = interpret.properties as Record<string, { enum?: string[] }>;
    expect(p.primaryToken.enum?.length).toBe(tokens.length);
  });
});
