import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import {
  collectGameVocabTokens,
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "./gameVocabEnums.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
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

  it("adds QUIT for planner enums", () => {
    const db = loadDatFile(datPath);
    const w = vocabTokensForLlmEnums(db);
    expect(w).toContain("QUIT");
    expect(w.length).toBeGreaterThanOrEqual(collectGameVocabTokens(db).length);
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
