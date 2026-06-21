import {
  chooseNextExplorationMove,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import type { NavigatorHintRequest, SlmAdapter } from "./slmAdapter.js";

const toUpperMove = (d: string | null): string | null =>
  d === null ? null : d.toUpperCase();

/**
 * CI / default adapter: **no remote model**. Uses deterministic exploration policy.
 * Satisfies tests without Ollama; honest labeling must still say “model-assisted” vs this path.
 */
export const createHeuristicSlmAdapter = (): SlmAdapter => ({
  completeNavigatorMove: async (
    req: NavigatorHintRequest,
  ): Promise<{ nextMoveUpper: string | null }> => {
    /** Map snapshot is rebuilt by LangGraph cartographer node before navigator runs. */
    const g = req.mapJson as DirectedMapGraph;
    const mv = chooseNextExplorationMove(g);
    return { nextMoveUpper: toUpperMove(mv) };
  },
});
