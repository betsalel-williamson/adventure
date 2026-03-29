import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDatFile } from "../dat/loadDat.js";
import { InferredExplorationMap } from "./inferredExplorationMap.js";
import { interpretedToGetinLine } from "./schema.js";
import type { InferredExplorationMapSnapshot } from "./inferredExplorationMap.js";
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
    expect(mer).toContain("flowchart TD");
    expect(mer).toContain("-->");
    expect(mer).toMatch(/\["OPEN FOREST"\]/);
    expect(mer).not.toMatch(/YOU ARE IN OPEN FOREST/);
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

  it("emits parse-safe Mermaid edge labels (no broken pipe text from parens or slashes)", () => {
    const snap: InferredExplorationMapSnapshot = {
      current: { x: 3, y: 0, z: 0 },
      currentGraphNodeId: "k_3_0_0",
      lastFingerprint: "YOU ARE IN FOREST",
      cells: [
        {
          graphNodeId: "k_3_0_0",
          x: 3,
          y: 0,
          z: 0,
          fingerprint: "YOU ARE IN FOREST",
          roomKind: "forest",
          label: "YOU ARE IN FOREST",
          groundObjectWords: null,
          takeableObjectWords: null,
          visibleObjectCount: null,
        },
      ],
      exitOutcomes: {},
      directedEdges: [
        {
          from: "k_3_0_0",
          to: "k_3_0_0",
          label: "FOREST WATER (use TAKE/GET + object)",
          kind: "self",
        },
      ],
      triedCommandsByNode: {},
      nonLocationActionsByNode: {},
    };
    const mer = inferredMapToMermaid(snap);
    expect(mer).toContain("k_3_0_0 -->|");
    expect(mer).not.toMatch(/\|[^\n]*\([^\n]*\|/);
    expect(mer).toMatch(/k_3_0_0 -->\|[^|]*…\| k_3_0_0/);
    expect(mer).toMatch(/\["FOREST"\]/);
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
    expect(mer).not.toMatch(/takeable/i);
    expect(mer).toMatch(/\["BUILDING"\]/);
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
