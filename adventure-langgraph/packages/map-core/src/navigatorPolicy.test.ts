import { describe, expect, it } from "vitest";
import type { DirectedMapGraph, PlaceId } from "./directedGraph.js";
import { chooseNextExplorationMove } from "./navigatorPolicy.js";

const graphWithCurrent = (current: PlaceId): DirectedMapGraph => ({
  places: [
    { id: current, evidence: "YOU ARE HERE" },
    { id: "p1", evidence: "YOU ARE THERE" },
  ],
  committedEdges: [
    {
      fromId: current,
      toId: "p1",
      move: "n",
    },
  ],
  currentPlaceId: current,
  nextPlaceIndex: 2,
});

describe("chooseNextExplorationMove", () => {
  it("returns first missing compass from current node", () => {
    const g = graphWithCurrent("p0" as PlaceId);
    const next = chooseNextExplorationMove(g);
    /** North already explored from p0 → expect EAST first in search order. */
    expect(next).toBe("e");
  });
});
