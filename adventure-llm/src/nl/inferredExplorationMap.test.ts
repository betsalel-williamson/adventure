import { describe, expect, it } from "vitest";
import {
  classifyRoomFingerprint,
  describeMotionGridDelta,
  extractLocationLineForFingerprint,
  fingerprintLocationFromGameOutput,
  fsmLabelFromGetinCommand,
  graphEdgeLabelFromCommand,
  InferredExplorationMap,
  detectLocationStagnation,
  fingerprintLocationFromExcerpt,
  MOTION_GRID_DELTA,
  canonicalMotionPrimaryForDedup,
  cardinalRotationForCellKey,
  orderedEscapePrimariesForCellKey,
  vecKey,
} from "./inferredExplorationMap.js";
import { interpretedToGetinLine } from "./schema.js";

describe("fingerprintLocationFromExcerpt", () => {
  it("normalizes whitespace and caps length", () => {
    expect(fingerprintLocationFromExcerpt("  YOU ARE HERE  ")).toBe(
      "YOU ARE HERE",
    );
  });
});

describe("orderedEscapePrimariesForCellKey", () => {
  it("rotates cardinals deterministically per inferred cell key", () => {
    expect(cardinalRotationForCellKey("0,0,0")).toBe(3);
    expect(orderedEscapePrimariesForCellKey("0,0,0")[0]).toBe("SOUTH");
    expect(orderedEscapePrimariesForCellKey("2,0,1")[0]).toBe("NORTH");
  });

  it("omits diagonal compass primaries from the tail unless ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION is set", () => {
    const prev = process.env.ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION;
    try {
      delete process.env.ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION;
      const order = orderedEscapePrimariesForCellKey("0,0,0");
      expect(order).not.toContain("NE");
      expect(order).toContain("UP");

      process.env.ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION = "1";
      const orderDiag = orderedEscapePrimariesForCellKey("0,0,0");
      expect(orderDiag).toContain("NE");
      expect(orderDiag.indexOf("NE")).toBeLessThan(orderDiag.indexOf("UP"));
    } finally {
      if (prev === undefined)
        delete process.env.ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION;
      else process.env.ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION = prev;
    }
  });
});

describe("graphEdgeLabelFromCommand", () => {
  it("annotates noun-as-primary GETIN lines for graph readers", () => {
    expect(graphEdgeLabelFromCommand("TAKE KEYS")).toBe("TAKE KEYS");
    expect(graphEdgeLabelFromCommand("NORTH")).toBe("NORTH");
    const keysKey = interpretedToGetinLine({
      primaryToken: "KEYS",
      secondaryToken: "KEY",
    });
    expect(graphEdgeLabelFromCommand(keysKey)).toBe(
      "KEYS KEY (use TAKE/GET + object)",
    );
  });
});

describe("fsmLabelFromGetinCommand", () => {
  it("includes secondary token for TAKE KEYS style GETIN", () => {
    expect(fsmLabelFromGetinCommand("TAKE KEYS")).toBe("TAKE KEYS");
    expect(fsmLabelFromGetinCommand("DROP LAMP")).toBe("DROP LAMP");
  });

  it("returns primary only when no secondary", () => {
    expect(fsmLabelFromGetinCommand("NORTH")).toBe("NORTH");
    expect(fsmLabelFromGetinCommand("LOOK")).toBe("LOOK");
  });
});

describe("extractLocationLineForFingerprint", () => {
  it("prefers YOU ARE after a blocked-move prefix on one line", () => {
    const text =
      "THERE IS NO WAY TO GO THAT DIRECTION. YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.";
    expect(extractLocationLineForFingerprint(text)).toContain(
      "YOU ARE IN A MAZE",
    );
  });

  it("returns null when no room line", () => {
    expect(extractLocationLineForFingerprint("WHAT?")).toBe(null);
  });

  it("skips YOU ARE ALREADY CARRYING (not a place line)", () => {
    expect(
      extractLocationLineForFingerprint("YOU ARE ALREADY CARRYING IT!"),
    ).toBe(null);
  });

  it("skips carrying line and uses the next YOU ARE place line", () => {
    const text =
      "YOU ARE ALREADY CARRYING IT. YOU ARE INSIDE A BUILDING FOR A LARGE SPRING.";
    expect(extractLocationLineForFingerprint(text)).toContain("YOU ARE INSIDE");
  });
});

describe("fingerprintLocationFromGameOutput", () => {
  it("fingerprints from extracted room line when blocked prefix is first", () => {
    const text =
      "THERE IS NO WAY TO GO THAT DIRECTION. YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.";
    const fp = fingerprintLocationFromGameOutput(text);
    expect(fp.startsWith("YOU ARE IN A MAZE")).toBe(true);
  });

  it("does not fingerprint carrying-only messages as a room", () => {
    expect(
      fingerprintLocationFromGameOutput("YOU ARE ALREADY CARRYING IT!"),
    ).toBe("");
  });

  it("does not fingerprint OK-only blobs as a room", () => {
    expect(fingerprintLocationFromGameOutput("OK\n")).toBe("");
  });
});

describe("describeMotionGridDelta", () => {
  it("returns map dz for DOWN and UP", () => {
    expect(describeMotionGridDelta("DOWN")).toBe("map Δz-1");
    expect(describeMotionGridDelta("UP")).toBe("map Δz+1");
  });

  it("returns map dz for IN and OUT", () => {
    expect(describeMotionGridDelta("IN")).toBe("map Δz-1");
    expect(describeMotionGridDelta("OUT")).toBe("map Δz+1");
  });

  it("returns horizontal deltas for NORTH and NE", () => {
    expect(describeMotionGridDelta("NORTH")).toBe("map Δy+1");
    expect(describeMotionGridDelta("NE")).toBe("map Δx+1,Δy+1");
  });

  it("matches single-letter compass to full-name grid deltas", () => {
    expect(describeMotionGridDelta("S")).toBe("map Δy-1");
    expect(describeMotionGridDelta("N")).toBe("map Δy+1");
    expect(describeMotionGridDelta("E")).toBe("map Δx+1");
    expect(describeMotionGridDelta("W")).toBe("map Δx-1");
  });

  it("returns null for unknown primary", () => {
    expect(describeMotionGridDelta("ROAD")).toBe(null);
    expect(describeMotionGridDelta("LOOK")).toBe(null);
  });
});

describe("canonicalMotionPrimaryForDedup", () => {
  it("maps single-letter compass to full names", () => {
    expect(canonicalMotionPrimaryForDedup("N")).toBe("NORTH");
    expect(canonicalMotionPrimaryForDedup("NORTH")).toBe("NORTH");
    expect(canonicalMotionPrimaryForDedup("S")).toBe("SOUTH");
    expect(canonicalMotionPrimaryForDedup("E")).toBe("EAST");
    expect(canonicalMotionPrimaryForDedup("W")).toBe("WEST");
  });

  it("leaves non-motion primaries unchanged", () => {
    expect(canonicalMotionPrimaryForDedup("TAKE")).toBe("TAKE");
    expect(canonicalMotionPrimaryForDedup("ROAD")).toBe("ROAD");
  });
});

describe("classifyRoomFingerprint", () => {
  it("labels road before nearby building word", () => {
    const { roomKind } = classifyRoomFingerprint(
      "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING.",
    );
    expect(roomKind).toBe("road");
  });

  it("labels well house as building", () => {
    const { roomKind } = classifyRoomFingerprint(
      "YOU ARE INSIDE A BUILDING, A WELL HOUSE FOR A LARGE SPRING.",
    );
    expect(roomKind).toBe("building");
  });

  it("labels maze", () => {
    const { roomKind } = classifyRoomFingerprint(
      "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.",
    );
    expect(roomKind).toBe("maze");
  });
});

describe("detectLocationStagnation", () => {
  it("is false until enough successful same-fp turns", () => {
    const fp = "YOU ARE AT THE END OF A ROAD";
    expect(
      detectLocationStagnation(
        [
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
        ],
        3,
      ),
    ).toBe(false);
    expect(
      detectLocationStagnation(
        [
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
        ],
        3,
      ),
    ).toBe(true);
  });

  it("ignores parser-rejection turns when counting successes", () => {
    const fp = "SAME ROOM";
    const other = "OTHER ROOM";
    expect(
      detectLocationStagnation(
        [
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: "REJECTED", outcomeWasParserRejection: true },
          { outcomeExcerpt: other, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
        ],
        3,
      ),
    ).toBe(false);
    expect(
      detectLocationStagnation(
        [
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: "REJECTED", outcomeWasParserRejection: true },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
          { outcomeExcerpt: fp, outcomeWasParserRejection: false },
        ],
        3,
      ),
    ).toBe(true);
  });
});

describe("InferredExplorationMap", () => {
  it("applies grid delta on new room after NORTH", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE AT THE START.\n");
    const north = interpretedToGetinLine({ primaryToken: "NORTH" });
    m.recordOutcome(north, "YOU ARE IN A FOREST NOW", false);
    expect(m.getCurrentVec()).toEqual({
      x: 0,
      y: MOTION_GRID_DELTA.NORTH!.dy,
      z: 0,
    });
  });

  it("snaps to known room fingerprint on revisit", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("ROOM A\n");
    const east = interpretedToGetinLine({ primaryToken: "EAST" });
    m.recordOutcome(east, "ROOM B LINE", false);
    const vecB = { ...m.getCurrentVec() };
    const west = interpretedToGetinLine({ primaryToken: "WEST" });
    m.recordOutcome(west, "ROOM A", false);
    const east2 = interpretedToGetinLine({ primaryToken: "EAST" });
    m.recordOutcome(east2, "ROOM B LINE", false);
    expect(m.getCurrentVec()).toEqual(vecB);
  });

  it("deduplicates repeated move edges between the same nodes", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE AT A.\n");
    const fpB = "YOU ARE IN PLACE B.";
    const fpA = "YOU ARE AT A.";
    m.recordOutcome("NORTH", fpB, false);
    m.recordOutcome("SOUTH", fpA, false);
    m.recordOutcome("NORTH", fpB, false);
    const snap = m.toSnapshot();
    const northMoves = snap.directedEdges.filter(
      (e) => e.kind === "move" && e.label === "NORTH",
    );
    expect(northMoves.length).toBe(1);
  });

  it("treats N and NORTH as one edge for deduplication", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE AT A.\n");
    const fpB = "YOU ARE IN PLACE B.";
    const fpA = "YOU ARE AT A.";
    m.recordOutcome("N", fpB, false);
    m.recordOutcome("SOUTH", fpA, false);
    m.recordOutcome("NORTH", fpB, false);
    const snap = m.toSnapshot();
    const northMoves = snap.directedEdges.filter(
      (e) => e.kind === "move" && e.label.startsWith("N"),
    );
    expect(northMoves.length).toBe(1);
  });

  it("marks same-room motion and offers escape primary", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const look = interpretedToGetinLine({ primaryToken: "LOOK" });
    m.recordOutcome(look, "YOU ARE STANDING AT THE END OF A ROAD", false);
    m.recordOutcome(look, "YOU ARE STANDING AT THE END OF A ROAD", false);
    expect(m.getDeadEndPrimariesFromCurrentCell()).toContain("LOOK");
    const part = m.partitionDeadEndPrimariesFromCurrentCell();
    expect(part.other).toContain("LOOK");
    expect(part.travel).not.toContain("LOOK");
    const rejected = new Set<string>();
    const picked = m.pickEscapePrimary(rejected);
    // Cell "0,0,0" uses rotated cardinals (not globally EAST-first); hash → SOUTH first here.
    expect(picked).toBe("SOUTH");
  });

  it("uses teleport when motion has no grid delta and room is new", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("START\n");
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    m.recordOutcome(road, "YOU ARE IN A DIFFERENT PLACE ENTIRELY.\n", false);
    expect(m.getCurrentVec().x).toBe(1);
  });

  it("applies dz -1 for IN into a new room (grate → chamber beneath)", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(
      "YOU ARE IN A 20 FOOT DEPRESSION FLOORED WITH BARE DIRT. SET INTO THE DIRT IS A STRONG STEEL GRATE MOUNTED IN CONCRETE.\n",
    );
    expect(m.getCurrentVec().z).toBe(0);
    const inn = interpretedToGetinLine({ primaryToken: "IN" });
    m.recordOutcome(
      inn,
      "YOU ARE IN A SMALL CHAMBER BENEATH A 3X3 STEEL GRATE TO THE SURFACE. A LOW CRAWL OVER COBBLES LEADS INWARD TO THE WEST. THE GRATE IS LOCKED.\n",
      false,
    );
    expect(m.getCurrentVec().z).toBe(-1);
  });

  it("applies dz +1 for OUT back to a higher level", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(
      "YOU ARE IN A 20 FOOT DEPRESSION FLOORED WITH BARE DIRT. SET INTO THE DIRT IS A STRONG STEEL GRATE MOUNTED IN CONCRETE.\n",
    );
    const inn = interpretedToGetinLine({ primaryToken: "IN" });
    m.recordOutcome(
      inn,
      "YOU ARE IN A SMALL CHAMBER BENEATH A 3X3 STEEL GRATE TO THE SURFACE.\n",
      false,
    );
    expect(m.getCurrentVec().z).toBe(-1);
    const out = interpretedToGetinLine({ primaryToken: "OUT" });
    m.recordOutcome(
      out,
      "YOU ARE IN A 20 FOOT DEPRESSION FLOORED WITH BARE DIRT. SET INTO THE DIRT IS A STRONG STEEL GRATE MOUNTED IN CONCRETE.\n",
      false,
    );
    expect(m.getCurrentVec().z).toBe(0);
  });

  it("OUT from well house snaps to occupied surface cell when location text differs from seed", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(
      "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING.\n",
    );
    expect(m.getCurrentVec()).toEqual({ x: 0, y: 0, z: 0 });
    const inn = interpretedToGetinLine({ primaryToken: "IN" });
    m.recordOutcome(
      inn,
      "YOU ARE INSIDE A BUILDING, A WELL HOUSE FOR A LARGE SPRING.\n",
      false,
    );
    expect(m.getCurrentVec().z).toBe(-1);
    const out = interpretedToGetinLine({ primaryToken: "OUT" });
    m.recordOutcome(out, "YOU'RE AT END OF ROAD AGAIN.\n", false);
    expect(m.getCurrentVec().z).toBe(0);
    expect(m.getCurrentVec().x).toBe(0);
  });

  it("toSnapshot lists cells, current position, and exit outcomes", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE AT THE START.\n");
    const north = interpretedToGetinLine({ primaryToken: "NORTH" });
    m.recordOutcome(north, "YOU ARE IN A FOREST NOW", false);
    const snap = m.toSnapshot();
    expect(snap.current).toEqual({
      x: 0,
      y: MOTION_GRID_DELTA.NORTH!.dy,
      z: 0,
    });
    expect(snap.cells.length).toBeGreaterThanOrEqual(2);
    const keys = new Set(snap.cells.map((c) => `${c.x},${c.y},${c.z}`));
    expect(keys.has("0,0,0")).toBe(true);
    expect(keys.has(`0,${MOTION_GRID_DELTA.NORTH!.dy},0`)).toBe(true);
    const cell0 = snap.exitOutcomes["0,0,0"];
    expect(
      cell0?.some((e) => e.primary === "NORTH" && e.outcome === "moved"),
    ).toBe(true);
    for (const c of snap.cells) {
      expect(c.roomKind).toBeDefined();
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.graphNodeId).toMatch(/^k_/);
    }
    expect(snap.currentGraphNodeId).toBeDefined();
    expect(snap.directedEdges.length).toBeGreaterThanOrEqual(1);
    expect(snap.triedCommandsByNode).toBeDefined();
  });

  it("records two-word GETIN object actions on local list and as informational FSM self-loops", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE IN A ROOM WITH KEYS ON THE GROUND.\n");
    m.recordOutcome("TAKE KEYS", "OK\nYOU ARE CARRYING KEYS", false);
    const snap = m.toSnapshot();
    const actionEdge = snap.directedEdges.find((e) => e.kind === "action");
    expect(actionEdge?.label.startsWith("TAKE")).toBe(true);
    expect(actionEdge?.from).toBe(actionEdge?.to);
    const locals = snap.nonLocationActionsByNode[snap.currentGraphNodeId] ?? [];
    const take = locals.find((a) => a.label.startsWith("TAKE"));
    expect(take?.label).toBe("TAKE KEYS");
  });

  it("labels noun-as-primary motion attempts on the session graph", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE AT A.\n");
    const keysKey = interpretedToGetinLine({
      primaryToken: "KEYS",
      secondaryToken: "KEY",
    });
    m.recordOutcome(keysKey, "YOU ARE AT A.", false);
    const snap = m.toSnapshot();
    const edge = snap.directedEdges.find((e) => e.label.includes("KEYS"));
    expect(edge?.label).toBe("KEYS KEY (use TAKE/GET + object)");
  });

  it("partitionDeadEndPrimaries separates WEST from LOOK", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const look = interpretedToGetinLine({ primaryToken: "LOOK" });
    const room = "YOU ARE STANDING AT THE END OF A ROAD";
    m.recordOutcome(look, room, false);
    m.recordOutcome(look, room, false);
    m.recordOutcome("WEST   ", room, false);
    const p = m.partitionDeadEndPrimariesFromCurrentCell();
    expect(p.other).toContain("LOOK");
    expect(p.travel).toContain("WEST");
    expect(p.travel).not.toContain("LOOK");
  });

  const mazeLine = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.";

  it("maze: repeated compass moves with identical text record moved and distinct cells", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(`${mazeLine}\n`);
    const south = interpretedToGetinLine({ primaryToken: "SOUTH" });
    m.recordOutcome(south, mazeLine, false);
    m.recordOutcome(south, mazeLine, false);
    m.recordOutcome(south, mazeLine, false);
    expect(m.getExitOutcome("0,0,0", "SOUTH")).toBe("moved");
    expect(vecKey(m.getCurrentVec())).not.toBe("0,0,0");
    expect(m.getDiscoveredRoomCount()).toBe(4);
  });

  it("maze: backtracking follows inverse edge to prior cell", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(`${mazeLine}\n`);
    const south = interpretedToGetinLine({ primaryToken: "SOUTH" });
    const north = interpretedToGetinLine({ primaryToken: "NORTH" });
    m.recordOutcome(south, mazeLine, false);
    const atSouth = m.getCurrentVec();
    m.recordOutcome(north, mazeLine, false);
    expect(m.getCurrentVec()).toEqual({ x: 0, y: 0, z: 0 });
    m.recordOutcome(south, mazeLine, false);
    expect(m.getCurrentVec()).toEqual(atSouth);
  });

  it("blocked move does not change position", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript(`${mazeLine}\n`);
    const before = m.getCurrentVec();
    const south = interpretedToGetinLine({ primaryToken: "SOUTH" });
    m.recordOutcome(
      south,
      `THERE IS NO WAY TO GO THAT DIRECTION. ${mazeLine}`,
      false,
      true,
    );
    expect(m.getCurrentVec()).toEqual(before);
    expect(m.getExitOutcome(vecKey(before), "SOUTH")).toBe("same");
  });
});
