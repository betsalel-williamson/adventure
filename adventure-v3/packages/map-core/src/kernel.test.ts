import { describe, expect, it } from "vitest";
import { createEmptyGraph } from "./directedGraph.js";
import { mergeGraphFromTranscript } from "./kernel.js";

describe("mergeGraphFromTranscript", () => {
  it("creates single place from oracle-only bootstrap", () => {
    let g = createEmptyGraph();
    g = mergeGraphFromTranscript(
      g,
      "YOU ARE STANDING BEFORE A LARGE STONE HOUSE.",
    );
    expect(g.places).toHaveLength(1);
    expect(g.places[0]?.evidence).toContain("STONE HOUSE");
    expect(g.currentPlaceId).toBe(g.places[0]?.id ?? null);
    expect(g.committedEdges).toHaveLength(0);
  });

  it("adds directed edge echo then YOU ARE room line", () => {
    let g = createEmptyGraph();
    const t =
      "YOU ARE IN HALLWAY.\n" + "> NORTH\n" + "YOU ARE AT END OF ROAD WEST.";
    g = mergeGraphFromTranscript(g, t);
    expect(g.places.length).toBeGreaterThanOrEqual(2);
    expect(g.committedEdges).toHaveLength(1);
    expect(g.committedEdges[0]?.move).toBe("n");
    expect(g.currentPlaceId).toBe(g.places[g.places.length - 1]?.id);
  });
});
