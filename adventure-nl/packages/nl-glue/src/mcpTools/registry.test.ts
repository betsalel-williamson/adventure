import { describe, expect, it } from "vitest";
import { callGlueMcpTool, listGlueMcpToolDescriptors } from "./registry.js";

describe("Glue MCP registry (ADR0016 C1)", () => {
  it("lists stable tool names in sorted order", () => {
    const names = listGlueMcpToolDescriptors()
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([
      "apply_heuristics",
      "get_exploration_summary",
      "ingest_transcript_delta",
      "map_current_state",
    ]);
  });

  it("map_current_state summarizes a minimal snapshot", async () => {
    const snap = {
      current: { x: 0, y: 0, z: 0 },
      currentGraphNodeId: "k_0_0_0",
      lastFingerprint: "YOU ARE AT END OF ROAD.",
      cells: [
        {
          graphNodeId: "k_0_0_0",
          x: 0,
          y: 0,
          z: 0,
          fingerprint: "YOU ARE AT END OF ROAD.",
          roomKind: "road" as const,
          label: "End of road",
          groundObjectWords: null,
          takeableObjectWords: null,
          visibleObjectCount: null,
        },
      ],
      exitOutcomes: {},
      directedEdges: [],
      triedCommandsByNode: {},
      nonLocationActionsByNode: {},
    };
    const out = await callGlueMcpTool("map_current_state", { snapshot: snap });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0]!.text);
    expect(parsed.cellCount).toBe(1);
    expect(parsed.currentGraphNodeId).toBe("k_0_0_0");
  });

  it("apply_heuristics returns flags for transcript tail", async () => {
    const out = await callGlueMcpTool("apply_heuristics", {
      transcriptTail: "YOU'RE INSIDE BUILDING.\n",
    });
    const parsed = JSON.parse(out.content[0]!.text);
    expect(parsed.indoorBuildingNavigation).toBe(true);
  });

  it("ingest_transcript_delta extracts fingerprint heuristics", async () => {
    const out = await callGlueMcpTool("ingest_transcript_delta", {
      gameOutput: "YOU ARE IN A VALLEY.\nOK\n",
    });
    const parsed = JSON.parse(out.content[0]!.text);
    expect(parsed.parserRejection).toBe(false);
    expect(typeof parsed.locationFingerprint).toBe("string");
  });

  it("rejects unknown tools", async () => {
    const out = await callGlueMcpTool("no_such_tool", {});
    expect(out.isError).toBe(true);
  });
});
