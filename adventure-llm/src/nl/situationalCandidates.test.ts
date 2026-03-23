import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import {
  buildSituationalCandidateTokens,
  parseRelevantTokensResponse,
} from "./situationalCandidates.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("buildSituationalCandidateTokens", () => {
  it("includes directions and verbs, and objects mentioned in text", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 80 });
    expect(c).toContain("EAST");
    expect(c).toContain("TAKE");
    expect(c.some((w) => w === "KEYS" || w === "KEY" || w === "LAMP")).toBe(
      true,
    );
  });

  it("respects maxTotal", () => {
    const db = loadDatFile(datPath);
    const c = buildSituationalCandidateTokens(db, "LONG TEXT", {
      maxTotal: 5,
    });
    expect(c.length).toBeLessThanOrEqual(5);
  });
});

describe("parseRelevantTokensResponse", () => {
  it("filters to allowed set and uppercases", () => {
    const allowed = new Set(["EAST", "WEST", "TAKE"]);
    expect(
      parseRelevantTokensResponse(
        { relevantTokens: ["east", "NORTH", "TAKE"] },
        allowed,
      ),
    ).toEqual(["EAST", "TAKE"]);
  });
});
