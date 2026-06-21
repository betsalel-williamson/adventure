import {
  chooseNextExplorationMove,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import type {
  Ag2AgentRole,
  Ag2HandoffRequest,
  Ag2HandoffResult,
  Ag2LlmAdapter,
} from "./ag2Adapter.js";

const toUpperMove = (d: string | null): string | null =>
  d === null ? null : d.toUpperCase();

const nextHandoff = (role: Ag2AgentRole): Ag2AgentRole | null => {
  if (role === "cartographer") {
    return "navigator";
  }
  if (role === "navigator") {
    return "reviewer";
  }
  return null;
};

/**
 * CI / default adapter: **no remote model**. Deterministic multi-agent handoff
 * using map-core exploration policy for navigator moves.
 */
export const createHeuristicAg2Adapter = (): Ag2LlmAdapter => ({
  completeHandoffTurn: async (
    req: Ag2HandoffRequest,
  ): Promise<Ag2HandoffResult> => {
    const g = req.mapJson as DirectedMapGraph;

    if (req.role === "cartographer") {
      const placeCount = g.places?.length ?? 0;
      return {
        summary: `Draft map has ${placeCount} place(s) from transcript cues.`,
        handoffTo: nextHandoff("cartographer"),
      };
    }

    if (req.role === "navigator") {
      const mv = toUpperMove(chooseNextExplorationMove(g));
      return {
        summary:
          mv === null
            ? "No unexplored compass exit; stopping probe."
            : `Propose move ${mv} from draft map.`,
        handoffTo: nextHandoff("navigator"),
        nextMoveUpper: mv,
      };
    }

    return {
      summary: "Reviewer accepts navigator proposal (heuristic pass-through).",
      handoffTo: null,
    };
  },
});
