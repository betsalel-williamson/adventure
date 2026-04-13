import { z } from "zod";
import {
  fingerprintLocationFromGameOutput,
  type InferredExplorationMapSnapshot,
} from "../inferredExplorationMap.js";
import {
  inferredMapToDot,
  inferredMapToMermaid,
} from "../explorationGraphViz.js";
import {
  gameOutputLooksLikeBlockedMove,
  gameOutputLooksLikeParserRejection,
} from "../autoplaySessionMemory.js";
import {
  recentTextSuggestsIndoorBuildingNavigation,
  recentTextSuggestsVerticalPassageNavigation,
} from "../situationalCandidates.js";
import {
  inferredMapSnapshotInputSchema,
  type InferredMapSnapshotInput,
} from "./snapshotInputSchema.js";

export const GLUE_MCP_SERVER_NAME = "adventure-nl-glue";
export const GLUE_MCP_SERVER_VERSION = "0.1.0";

export type GlueMcpToolDescriptor = {
  readonly name: string;
  readonly description: string;
  /** JSON Schema object for MCP `tools/list` (draft-07 style). */
  readonly inputSchema: Record<string, unknown>;
};

export type GlueMcpToolCallResult = {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
};

const applyHeuristicsInputSchema = z.object({
  transcriptTail: z.string(),
});

const ingestTranscriptDeltaInputSchema = z.object({
  gameOutput: z.string(),
});

const getExplorationSummaryInputSchema = z.object({
  snapshot: inferredMapSnapshotInputSchema,
  format: z.enum(["mermaid", "dot"]).default("mermaid"),
});

const mapCurrentStateInputSchema = z.object({
  snapshot: inferredMapSnapshotInputSchema,
});

function asSnapshot(
  s: InferredMapSnapshotInput,
): InferredExplorationMapSnapshot {
  // Input is boundary-validated only for transport and core fields. Keep this cast
  // so Glue tools stay forward-compatible with host snapshots that include extra
  // inferred-map fields added over time.
  return s as unknown as InferredExplorationMapSnapshot;
}

function textResult(obj: unknown): GlueMcpToolCallResult {
  return {
    content: [{ type: "text", text: JSON.stringify(obj) }],
  };
}

function errorResult(message: string): GlueMcpToolCallResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}

const DESCRIPTORS: readonly GlueMcpToolDescriptor[] = [
  {
    name: "map_current_state",
    description:
      "Summarize a host-supplied inferred exploration map snapshot (cells, edges, current node).",
    inputSchema: {
      type: "object",
      properties: {
        snapshot: {
          type: "object",
          description: "InferredExplorationMapSnapshot JSON",
        },
      },
      required: ["snapshot"],
    },
  },
  {
    name: "get_exploration_summary",
    description:
      "Render Mermaid or Graphviz DOT for an inferred map snapshot (capped in nl-glue viz).",
    inputSchema: {
      type: "object",
      properties: {
        snapshot: { type: "object" },
        format: { type: "string", enum: ["mermaid", "dot"] },
      },
      required: ["snapshot"],
    },
  },
  {
    name: "apply_heuristics",
    description:
      "Pure transcript heuristics (indoor building / vertical passage cues) over a tail string.",
    inputSchema: {
      type: "object",
      properties: {
        transcriptTail: { type: "string" },
      },
      required: ["transcriptTail"],
    },
  },
  {
    name: "ingest_transcript_delta",
    description:
      "Classify fresh engine text for glue reconciliation (parser rejection, blocked move, location fingerprint).",
    inputSchema: {
      type: "object",
      properties: {
        gameOutput: { type: "string" },
      },
      required: ["gameOutput"],
    },
  },
];

export function listGlueMcpToolDescriptors(): readonly GlueMcpToolDescriptor[] {
  return DESCRIPTORS;
}

export async function callGlueMcpTool(
  name: string,
  args: unknown,
): Promise<GlueMcpToolCallResult> {
  switch (name) {
    case "map_current_state": {
      const parsed = mapCurrentStateInputSchema.safeParse(args);
      if (!parsed.success) {
        return errorResult(parsed.error.message);
      }
      const snap = asSnapshot(parsed.data.snapshot);
      return textResult({
        currentGraphNodeId: snap.currentGraphNodeId,
        currentVec: snap.current,
        cellCount: snap.cells.length,
        directedEdgeCount: snap.directedEdges.length,
        lastFingerprint: snap.lastFingerprint,
      });
    }
    case "get_exploration_summary": {
      const parsed = getExplorationSummaryInputSchema.safeParse(args);
      if (!parsed.success) {
        return errorResult(parsed.error.message);
      }
      const snap = asSnapshot(parsed.data.snapshot);
      const text =
        parsed.data.format === "dot"
          ? inferredMapToDot(snap)
          : inferredMapToMermaid(snap);
      return textResult({ format: parsed.data.format, text });
    }
    case "apply_heuristics": {
      const parsed = applyHeuristicsInputSchema.safeParse(args);
      if (!parsed.success) {
        return errorResult(parsed.error.message);
      }
      const t = parsed.data.transcriptTail;
      return textResult({
        indoorBuildingNavigation: recentTextSuggestsIndoorBuildingNavigation(t),
        verticalPassageNavigation:
          recentTextSuggestsVerticalPassageNavigation(t),
      });
    }
    case "ingest_transcript_delta": {
      const parsed = ingestTranscriptDeltaInputSchema.safeParse(args);
      if (!parsed.success) {
        return errorResult(parsed.error.message);
      }
      const g = parsed.data.gameOutput;
      return textResult({
        parserRejection: gameOutputLooksLikeParserRejection(g),
        blockedMove: gameOutputLooksLikeBlockedMove(g),
        locationFingerprint: fingerprintLocationFromGameOutput(g),
      });
    }
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}
