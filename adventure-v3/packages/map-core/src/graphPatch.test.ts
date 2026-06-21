import { describe, expect, it } from "vitest";
import { createEmptyGraph } from "./directedGraph.js";
import {
  applyLocationGraphPatch,
  parseLocationGraphPatch,
} from "./graphPatch.js";

describe("applyLocationGraphPatch", () => {
  it("adds a place and sets current when graph is empty", () => {
    const next = applyLocationGraphPatch(createEmptyGraph(), {
      place: { evidence: "YOU ARE AT END OF ROAD" },
      currentPlaceId: "p0",
    });
    expect(next.places).toHaveLength(1);
    expect(next.currentPlaceId).toBe("p0");
  });

  it("commits a compass edge when patch includes edge", () => {
    const base = applyLocationGraphPatch(createEmptyGraph(), {
      place: { evidence: "YOU ARE AT END OF ROAD" },
      currentPlaceId: "p0",
    });
    const next = applyLocationGraphPatch(base, {
      place: { evidence: "YOU ARE IN A VALLEY" },
      edge: { fromId: "p0", toId: "p1", move: "n" },
      currentPlaceId: "p1",
    });
    expect(next.committedEdges).toEqual([
      { fromId: "p0", toId: "p1", move: "n" },
    ]);
    expect(next.currentPlaceId).toBe("p1");
  });

  it("rejects invalid patch shapes via parseLocationGraphPatch", () => {
    expect(parseLocationGraphPatch({ edge: { fromId: "x", move: "n" } })).toBe(
      null,
    );
  });
});
