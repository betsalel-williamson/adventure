import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import {
  buildSituationalCandidateTokens,
  countVisibleAdventureObjectsInText,
  formatSituationalCandidatesSection,
  parseRelevantTokensResponse,
  recentTextSuggestsGrateDescentNavigation,
  recentTextSuggestsIndoorBuildingNavigation,
  recentTextSuggestsVerticalPassageNavigation,
  listVisibleRoomObjectsNotCarried,
  shouldPrioritizeLootFunnel,
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

  it("grate context lists DOWN before compass when room objects are present", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU'RE OUTSIDE GRATE. THERE IS WATER HERE. A METAL GRATE IN THE STREAM.\n";
    const c = buildSituationalCandidateTokens(db, text, { maxTotal: 60 });
    const iDown = c.indexOf("DOWN");
    const iEast = c.indexOf("EAST");
    expect(iDown).toBeGreaterThanOrEqual(0);
    if (iEast >= 0) expect(iDown).toBeLessThan(iEast);
  });

  it("objectHintScopeText ignores stale GRATE from an earlier room in the tail", () => {
    const db = loadDatFile(datPath);
    const fullTail = [
      "YOU'RE OUTSIDE GRATE. SMALL STREAM. WATER HERE. METAL GRATE.",
      "",
      "YOU'RE IN OPEN FOREST, WITH A DEEP VALLEY IN ONE DIRECTION.",
    ].join("\n");
    const forestOnly =
      "YOU'RE IN OPEN FOREST, WITH A DEEP VALLEY IN ONE DIRECTION.";
    const cFull = buildSituationalCandidateTokens(db, fullTail, {
      maxTotal: 80,
    });
    const cScoped = buildSituationalCandidateTokens(db, fullTail, {
      maxTotal: 80,
      objectHintScopeText: forestOnly,
    });
    expect(cFull).toContain("GRATE");
    expect(cScoped.includes("GRATE")).toBe(false);
    expect(shouldPrioritizeLootFunnel(db, forestOnly, [], undefined)).toBe(
      false,
    );
    expect(shouldPrioritizeLootFunnel(db, fullTail, [], undefined)).toBe(true);
  });

  it("lootFunnel retains DOWN/UP when vertical passage context (travel otherwise hidden)", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU'RE OUTSIDE GRATE. SMALL STREAM. WATER HERE. METAL GRATE.\n";
    const c = buildSituationalCandidateTokens(db, text, {
      maxTotal: 80,
      lootFunnel: true,
    });
    expect(c).toContain("DOWN");
    expect(c).toContain("UP");
    expect(c).toContain("TAKE");
    expect(c.includes("EAST")).toBe(false);
  });

  it("lootFunnel retains vertical motion for ladder + shaft-style text", () => {
    const db = loadDatFile(datPath);
    const text = "NARROW LADDER LEADS UP. SOME WATER HERE.\n";
    expect(recentTextSuggestsVerticalPassageNavigation(text)).toBe(true);
    const c = buildSituationalCandidateTokens(db, text, {
      maxTotal: 80,
      lootFunnel: true,
    });
    expect(c).toContain("DOWN");
    expect(c).toContain("UP");
    expect(c.includes("NORTH")).toBe(false);
  });

  it("lootFunnel drops CLASS_MOTION tokens even when exploreFirst would apply", () => {
    const db = loadDatFile(datPath);
    const text =
      "YOU ARE IN A BUILDING. THERE ARE SOME KEYS ON THE GROUND. A BRASS LAMP IS NEARBY.";
    const c = buildSituationalCandidateTokens(db, text, {
      maxTotal: 80,
      exploreFirst: true,
      lootFunnel: true,
    });
    expect(c).toContain("TAKE");
    expect(c).toContain("KEYS");
    expect(c.some((t) => t === "EAST" || t === "WEST")).toBe(false);
    expect(c).toContain("LOOK");
  });

  it("shouldPrioritizeLootFunnel matches room objects minus carried (loot gate)", () => {
    const db = loadDatFile(datPath);
    const text = "YOU'RE INSIDE BUILDING. KEYS ON GROUND. LAMP NEARBY.";
    expect(shouldPrioritizeLootFunnel(db, text, [])).toBe(true);
    expect(
      shouldPrioritizeLootFunnel(db, text, [
        "YOU ARE CARRYING SOME KEYS",
        "YOU ARE CARRYING A LAMP",
      ]),
    ).toBe(false);
    expect(
      shouldPrioritizeLootFunnel(db, text, ["YOU ARE CARRYING SOME KEYS"]),
    ).toBe(true);
    expect(
      listVisibleRoomObjectsNotCarried(db, text, [
        "YOU ARE CARRYING SOME KEYS",
      ]),
    ).toContain("LAMP");
    expect(
      listVisibleRoomObjectsNotCarried(db, text, [], ["LAMP"]),
    ).not.toContain("LAMP");
  });

  it("takeFailureSubtractWords omits learned-untakeable objects from Cand_Obj", () => {
    const db = loadDatFile(datPath);
    const text = "YOU'RE OUTSIDE GRATE. METAL GRATE. WATER IN THE STREAM.\n";
    const withGrate = buildSituationalCandidateTokens(db, text, {
      maxTotal: 60,
    });
    expect(withGrate).toContain("GRATE");
    const withoutGrate = buildSituationalCandidateTokens(db, text, {
      maxTotal: 60,
      takeFailureSubtractWords: ["GRATE"],
    });
    expect(withoutGrate.includes("GRATE")).toBe(false);
    expect(withoutGrate).toContain("WATER");
  });

  it("shouldPrioritizeLootFunnel is false when only remaining objects are take-failures", () => {
    const db = loadDatFile(datPath);
    const text = "YOU SEE A METAL GRATE.\n";
    expect(shouldPrioritizeLootFunnel(db, text, [], [])).toBe(true);
    expect(shouldPrioritizeLootFunnel(db, text, [], ["GRATE"])).toBe(false);
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

describe("recentTextSuggestsVerticalPassageNavigation", () => {
  it("matches grate, pit, stair, ladder, and chasm cues", () => {
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "YOU'RE OUTSIDE GRATE. THE STREAM BED.\n",
      ),
    ).toBe(true);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "A METAL GRATE IN THE TWENTY FOOT DEPRESSION.\n",
      ),
    ).toBe(true);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "YOU ARE AT THE BRINK OF A DEEP PIT.\n",
      ),
    ).toBe(true);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "ROUGH STONE STEPS LEAD DOWN.\n",
      ),
    ).toBe(true);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "THERE IS A RICKETY WOODEN LADDER HERE.\n",
      ),
    ).toBe(true);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "YOU ARE ON THE EDGE OF A BREATHTAKING CHASM.\n",
      ),
    ).toBe(true);
  });

  it("is false without vertical-passage cues", () => {
    expect(
      recentTextSuggestsVerticalPassageNavigation("YOU ARE IN A FOREST.\n"),
    ).toBe(false);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "ABOUT A GRATE OF CARROTS.\n",
      ),
    ).toBe(false);
    expect(
      recentTextSuggestsVerticalPassageNavigation(
        "A DEEP FOREST PITTED WITH STUMPS.\n",
      ),
    ).toBe(false);
  });

  it("grateDescentNavigation alias matches vertical passage", () => {
    const s = "YOU'RE OUTSIDE GRATE.\n";
    expect(recentTextSuggestsGrateDescentNavigation(s)).toBe(
      recentTextSuggestsVerticalPassageNavigation(s),
    );
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

  it("flatList emits comma-separated tokens only", () => {
    const db = loadDatFile(datPath);
    const s = formatSituationalCandidatesSection(
      db,
      ["EAST", "WEST", "TAKE"],
      undefined,
      { flatList: true },
    );
    expect(s).toContain("EAST, WEST, TAKE");
    expect(s).not.toMatch(/\*\*EAST\*\*\s*—/);
  });

  it("slmGrouped splits motion vs action vs object", () => {
    const db = loadDatFile(datPath);
    const s = formatSituationalCandidatesSection(
      db,
      ["EAST", "WEST", "TAKE", "KEYS"],
      undefined,
      { slmGrouped: true },
    );
    expect(s).toContain("**Cand_Move:**");
    expect(s).toContain("**Cand_Act:**");
    expect(s).toContain("**Cand_Obj:**");
    const iAct = s.indexOf("**Cand_Act:**");
    const iObj = s.indexOf("**Cand_Obj:**");
    const iMove = s.indexOf("**Cand_Move:**");
    expect(iAct).toBeLessThan(iObj);
    expect(iObj).toBeLessThan(iMove);
    expect(s).toMatch(/EAST.*WEST/);
    expect(s).toContain("TAKE");
    expect(s).toContain("KEYS");
  });

  it("lootFunnelDeferCandMove explains deferred travel when move list empty", () => {
    const db = loadDatFile(datPath);
    const s = formatSituationalCandidatesSection(
      db,
      ["TAKE", "GET", "KEYS"],
      undefined,
      { slmGrouped: true, lootFunnelDeferCandMove: true },
    );
    expect(s).toContain("deferred");
    expect(s).toContain("**Cand_Move:**");
    expect(s).not.toContain("EAST");
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
