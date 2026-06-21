import { describe, expect, it } from "vitest";
import { createEmptyGraph } from "@adventure-langgraph/map-core";
import { buildAssistGraph, runAssistStep } from "./assistGraph.js";
import { createHeuristicSlmAdapter } from "./slm/heuristicSlmAdapter.js";

describe("buildAssistGraph", () => {
  it("merges transcript and proposes a compass move", async () => {
    const compiled = buildAssistGraph(createHeuristicSlmAdapter());
    const transcript =
      "YOU ARE IN HALLWAY.\n> NORTH\nYOU ARE AT END OF ROAD WEST.";
    const r = await runAssistStep(compiled, {
      transcript,
      mapGraph: createEmptyGraph(),
      nextMove: null,
    });
    expect(r.mapGraph.places.length).toBeGreaterThanOrEqual(2);
    expect(r.nextMove).toMatch(/^[NESWUD]$/);
    expect(r.mermaid).toContain("flowchart LR");
  });
});
