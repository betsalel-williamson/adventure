import {
  createEmptyGraph,
  mergeGraphFromTranscript,
  directedGraphToMermaidFlowchart,
  graphToJson,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import type { Ag2AgentRole, Ag2LlmAdapter } from "./ag2Adapter.js";

export type Ag2HandoffState = {
  readonly transcript: string;
  readonly mapGraph: DirectedMapGraph;
  readonly activeRole: Ag2AgentRole;
  readonly agentSummaries: readonly string[];
  readonly nextMove: string | null;
};

export type Ag2HandoffStepResult = {
  readonly mapGraph: DirectedMapGraph;
  readonly nextMove: string | null;
  readonly mermaid: string;
  readonly mapJson: unknown;
  readonly agentSummaries: readonly string[];
  readonly completedRoles: readonly Ag2AgentRole[];
};

const HANDOFF_ORDER: readonly Ag2AgentRole[] = [
  "cartographer",
  "navigator",
  "reviewer",
];

export const runAg2HandoffStep = async (
  llm: Ag2LlmAdapter,
  input: Pick<Ag2HandoffState, "transcript" | "mapGraph">,
): Promise<Ag2HandoffStepResult> => {
  const mapGraph = mergeGraphFromTranscript(
    input.mapGraph ?? createEmptyGraph(),
    input.transcript,
  );

  const agentSummaries: string[] = [];
  const completedRoles: Ag2AgentRole[] = [];
  let nextMove: string | null = null;
  let priorSummary: string | undefined;

  for (const role of HANDOFF_ORDER) {
    const result = await llm.completeHandoffTurn({
      role,
      transcript: input.transcript,
      mapJson: graphToJson(mapGraph),
      priorAgentSummary: priorSummary,
    });

    agentSummaries.push(`${role}: ${result.summary}`);
    completedRoles.push(role);
    priorSummary = result.summary;

    if (role === "navigator") {
      const upper = result.nextMoveUpper?.trim() ?? null;
      nextMove =
        upper === null || upper === "" ? null : (upper[0]?.toUpperCase() ?? null);
    }

    if (result.handoffTo === null) {
      break;
    }
  }

  return {
    mapGraph,
    nextMove,
    mermaid: directedGraphToMermaidFlowchart(mapGraph),
    mapJson: graphToJson(mapGraph),
    agentSummaries,
    completedRoles,
  };
};
