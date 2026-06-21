import { describe, expect, it } from "vitest";
import { createEmptyGraph } from "@adventure-langgraph/map-core";
import { runAg2HandoffStep } from "./ag2HandoffGraph.js";
import { createHeuristicAg2Adapter } from "./heuristicAg2Adapter.js";

describe("runAg2HandoffStep", () => {
  it("runs cartographer → navigator → reviewer handoff and proposes a move", async () => {
    const llm = createHeuristicAg2Adapter();
    const transcript =
      "YOU ARE IN HALLWAY.\n> NORTH\nYOU ARE AT END OF ROAD WEST.";

    const result = await runAg2HandoffStep(llm, {
      transcript,
      mapGraph: createEmptyGraph(),
    });

    expect(result.mapGraph.places.length).toBeGreaterThanOrEqual(2);
    expect(result.nextMove).toMatch(/^[NESWUD]$/);
    expect(result.completedRoles).toEqual([
      "cartographer",
      "navigator",
      "reviewer",
    ]);
    expect(result.agentSummaries).toHaveLength(3);
    expect(result.mermaid).toContain("flowchart LR");
  });
});
