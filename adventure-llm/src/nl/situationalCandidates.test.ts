import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import {
  buildSituationalCandidateTokens,
  countVisibleAdventureObjectsInText,
  formatSituationalCandidatesSection,
  parseRelevantTokensResponse,
  recentTextSuggestsIndoorBuildingNavigation,
  stripInjectedCommandLinesForObjectHints,
} from "./situationalCandidates.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("countVisibleAdventureObjectsInText", () => {
  it("counts distinct object-class words present in prose", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY. AN EMPTY BOTTLE HERE.";
    const n = countVisibleAdventureObjectsInText(db, text);
    expect(n).toBeGreaterThanOrEqual(3);
  });
});

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

  it("lists TAKE and room objects before compass motion when objects appear in text", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 80 });
    const idxTake = c.indexOf("TAKE");
    const idxEast = c.indexOf("EAST");
    expect(idxTake).toBeGreaterThanOrEqual(0);
    expect(idxEast).toBeGreaterThanOrEqual(0);
    expect(idxTake).toBeLessThan(idxEast);
  });

  it("matches ATAB object words to longer prose (BOTTL ↔ BOTTLE)", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU'RE INSIDE BUILDING. THERE IS A SHINY BRASS LAMP NEARBY. THERE IS AN EMPTY BOTTLE HERE.";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 80 });
    expect(c).toContain("BOTTL");
    expect(c).toContain("LAMP");
    const idxTake = c.indexOf("TAKE");
    const idxOut = c.indexOf("OUT");
    expect(idxTake).toBeGreaterThanOrEqual(0);
    if (idxOut >= 0) expect(idxTake).toBeLessThan(idxOut);
  });

  it("lists LOOK and EXAMI after travel verbs and TAKE when budget allows", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 80 });
    const idxTake = c.indexOf("TAKE");
    const idxLook = c.indexOf("LOOK");
    const idxExami = c.indexOf("EXAMI");
    if (idxLook >= 0 && idxTake >= 0) {
      expect(idxLook).toBeGreaterThan(idxTake);
    }
    if (idxExami >= 0 && idxTake >= 0) {
      expect(idxExami).toBeGreaterThan(idxTake);
    }
  });

  it("respects maxTotal", () => {
    const db = loadDatFile(datPath);
    const c = buildSituationalCandidateTokens(db, "LONG TEXT", {
      maxTotal: 5,
    });
    expect(c.length).toBeLessThanOrEqual(5);
  });

  it("indoorLeaveBuilding lists OUT before NORTH when both present", () => {
    const db = loadDatFile(datPath);
    const text =
      "THERE IS NO WAY TO GO THAT DIRECTION. YOU'RE INSIDE BUILDING. LAMP.";
    const c = buildSituationalCandidateTokens(db, text, {
      maxTotal: 60,
      indoorLeaveBuilding: true,
    });
    const iOut = c.indexOf("OUT");
    const iNorth = c.indexOf("NORTH");
    if (iOut >= 0 && iNorth >= 0) {
      expect(iOut).toBeLessThan(iNorth);
    }
  });

  it("exploreFirst lists motion before TAKE when objects are present", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, {
      maxTotal: 80,
      exploreFirst: true,
    });
    const idxTake = c.indexOf("TAKE");
    const idxEast = c.indexOf("EAST");
    expect(idxEast).toBeGreaterThanOrEqual(0);
    expect(idxTake).toBeGreaterThanOrEqual(0);
    expect(idxEast).toBeLessThan(idxTake);
  });

  it("stripInjectedCommandLinesForObjectHints removes > lines", () => {
    const raw = "> TAKE KEYS\nYOU ARE IN FOREST.\n";
    expect(stripInjectedCommandLinesForObjectHints(raw)).not.toMatch(/>/);
    expect(stripInjectedCommandLinesForObjectHints(raw)).toMatch(/FOREST/);
  });

  it("inventorySubtractText removes object tokens also echoed in prose", () => {
    const db = loadDatFile(datPath);
    const text = "YOU SEE KEYS HERE AND A LAMP.";
    const withInv = buildSituationalCandidateTokens(db, text, {
      maxTotal: 80,
      inventorySubtractText: "KEYS",
    });
    expect(withInv.includes("KEYS")).toBe(false);
  });

  it("deprioritize moves tokens to the tail of the motion slice", () => {
    const db = loadDatFile(datPath);
    const text = "YOU ARE AT THE END OF A ROAD.";
    const without = buildSituationalCandidateTokens(db, text, {
      maxTotal: 40,
    });
    const withDep = buildSituationalCandidateTokens(db, text, {
      maxTotal: 40,
      deprioritize: ["LOOK", "ROAD"],
    });
    const idxLook = (arr: string[]) => arr.indexOf("LOOK");
    const idxRoad = (arr: string[]) => arr.indexOf("ROAD");
    if (idxLook(without) >= 0 && idxLook(withDep) >= 0) {
      expect(idxLook(withDep)).toBeGreaterThanOrEqual(idxLook(without));
    }
    if (idxRoad(without) >= 0 && idxRoad(withDep) >= 0) {
      expect(idxRoad(withDep)).toBeGreaterThanOrEqual(idxRoad(without));
    }
  });
});

describe("recentTextSuggestsIndoorBuildingNavigation", () => {
  it("is true for well house room line", () => {
    expect(
      recentTextSuggestsIndoorBuildingNavigation(
        "YOU ARE INSIDE A BUILDING, A WELL HOUSE FOR A LARGE SPRING.\n",
      ),
    ).toBe(true);
  });

  it("is true when compass failed with YOU'RE INSIDE BUILDING", () => {
    expect(
      recentTextSuggestsIndoorBuildingNavigation(
        "THERE IS NO WAY TO GO THAT DIRECTION. YOU'RE INSIDE BUILDING. LAMP.\n",
      ),
    ).toBe(true);
  });

  it("is false for standing outside near a building", () => {
    expect(
      recentTextSuggestsIndoorBuildingNavigation(
        "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING.\n",
      ),
    ).toBe(false);
  });
});

describe("formatSituationalCandidatesSection", () => {
  it("appends optional appendix and uses token — hint lines", () => {
    const db = loadDatFile(datPath);
    const s = formatSituationalCandidatesSection(
      db,
      ["EAST", "WEST"],
      "**Try next:** NORTH",
    );
    expect(s).toContain("**EAST**");
    expect(s).toMatch(/travel east/i);
    expect(s).toContain("Try next");
  });

  it("groups pickup before travel when room objects are in the list", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU'RE INSIDE BUILDING. THERE ARE SOME KEYS ON THE GROUND. THERE IS A SHINY BRASS LAMP NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 40 });
    const s = formatSituationalCandidatesSection(db, c);
    const pickIdx = s.indexOf("Pick up items");
    const leaveIdx = s.indexOf("Leave / move");
    expect(pickIdx).toBeGreaterThanOrEqual(0);
    expect(leaveIdx).toBeGreaterThanOrEqual(0);
    expect(pickIdx).toBeLessThan(leaveIdx);
    expect(s).toMatch(/\*\*KEYS\*\*/);
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
