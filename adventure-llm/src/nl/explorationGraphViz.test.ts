import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDatFile } from "../dat/loadDat.js";
import { InferredExplorationMap } from "./inferredExplorationMap.js";
import { interpretedToGetinLine } from "./schema.js";
import {
  inferredMapToDot,
  inferredMapToLocalDot,
  inferredMapToMermaid,
} from "./explorationGraphViz.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("explorationGraphViz", () => {
  it("emits Mermaid and DOT containing two navigation edges (out and back)", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const north = interpretedToGetinLine({ primaryToken: "NORTH" });
    m.recordOutcome(north, "YOU ARE IN OPEN FOREST", false);
    const south = interpretedToGetinLine({ primaryToken: "SOUTH" });
    m.recordOutcome(south, "YOU ARE STANDING AT THE END OF A ROAD", false);
    const snap = m.toSnapshot();
    expect(snap.directedEdges.length).toBeGreaterThanOrEqual(2);
    const mer = inferredMapToMermaid(snap);
    expect(mer).toContain("flowchart LR");
    expect(mer).toContain("-->");
    const dot = inferredMapToDot(snap);
    expect(dot).toContain("digraph exploration_fsm");
    expect(dot).toContain("->");
    expect(dot).toContain("edge [dir=forward; arrowhead=vee]");
    expect(dot).toContain("layout=neato");
    expect(dot).toContain("pos=");
    expect(dot).toContain("YOU ARE HERE");
    expect(dot).toContain('fillcolor="#3d3d5c"');
    expect(dot).toContain("// YOU ARE HERE = node");
  });

  it("emits local DOT with neighborhood around current cell", () => {
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const east = interpretedToGetinLine({ primaryToken: "EAST" });
    m.recordOutcome(east, "YOU ARE INSIDE A BUILDING.\n", false);
    const snap = m.toSnapshot();
    const local = inferredMapToLocalDot(snap, { maxHops: 2, maxEdges: 40 });
    expect(local).toContain("digraph planner_local_fsm");
    expect(local).toContain("peripheries=2");
    expect(local).toContain('fillcolor="#3d3d5c"');
    expect(local).toContain("YOU ARE HERE");
    expect(local).toContain("->");
    expect(local).toContain("edge [dir=forward; arrowhead=vee]");
  });

  it("includes visible object count in Mermaid and DOT labels when adventure.dat is used", () => {
    const db = loadDatFile(datPath);
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const east = interpretedToGetinLine({ primaryToken: "EAST" });
    const room =
      "YOU ARE INSIDE A BUILDING.\nTHERE ARE SOME KEYS HERE. A BRASS LAMP IS NEARBY. AN EMPTY BOTTLE HERE.\n";
    m.recordOutcome(east, room, false, false, { adventureDb: db });
    const snap = m.toSnapshot();
    const building = snap.cells.find((c) => c.graphNodeId !== "k_0_0_0");
    expect(building?.takeableObjectWords?.length).toBeGreaterThanOrEqual(3);
    const mer = inferredMapToMermaid(snap);
    expect(mer).toMatch(/takeable:/i);
    const dot = inferredMapToDot(snap);
    expect(dot).toContain("label=");
    expect(dot).toMatch(/takeable/i);
  });

  it("removes a taken object from room takeable list after OK TAKE", () => {
    const db = loadDatFile(datPath);
    const m = new InferredExplorationMap();
    m.seedFromTranscript("YOU ARE STANDING AT THE END OF A ROAD.\n", {
      adventureDb: db,
    });
    const east = interpretedToGetinLine({ primaryToken: "EAST" });
    const room =
      "YOU ARE INSIDE A BUILDING.\nTHERE ARE SOME KEYS HERE. A BRASS LAMP IS NEARBY. AN EMPTY BOTTLE HERE.\n";
    m.recordOutcome(east, room, false, false, {
      adventureDb: db,
      outcomeHadFortranOk: false,
    });
    const takeKeys = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    m.recordOutcome(takeKeys, "OK\n", false, false, {
      adventureDb: db,
      outcomeHadFortranOk: true,
    });
    const snap = m.toSnapshot();
    const building = snap.cells.find(
      (c) => c.x === 1 && c.y === 0 && c.z === 0,
    );
    expect(building?.groundObjectWords?.includes("KEYS")).toBe(false);
    expect(building?.takeableObjectWords?.includes("KEYS")).toBe(false);
    expect(building?.takeableObjectWords?.length).toBeGreaterThanOrEqual(2);
  });
});
