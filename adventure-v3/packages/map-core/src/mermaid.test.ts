import { describe, expect, it } from "vitest";
import type { DirectedMapGraph, PlaceId } from "./directedGraph.js";
import { directedGraphToMermaidFlowchart } from "./mermaid.js";

describe("directedGraphToMermaidFlowchart", () => {
  it("emits labeled flowchart for places and edges", () => {
    const g: DirectedMapGraph = {
      places: [
        { id: "p0" as PlaceId, evidence: "YOU ARE AT A." },
        { id: "p1" as PlaceId, evidence: "YOU ARE AT B." },
      ],
      committedEdges: [
        { fromId: "p0" as PlaceId, toId: "p1" as PlaceId, move: "e" },
      ],
      currentPlaceId: "p1" as PlaceId,
      nextPlaceIndex: 2,
    };
    const m = directedGraphToMermaidFlowchart(g);
    expect(m).toContain("flowchart LR");
    expect(m).toContain("classDef currentPlace");
    expect(m).toContain("class p1 currentPlace");
    expect(m).toContain("p0");
    expect(m).toContain('|"E"|');
  });
});
