import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  chooseNextExplorationMove,
  createEmptyGraph,
  mergeGraphFromTranscript,
  directedGraphToMermaidFlowchart,
  graphToJson,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import type { SlmAdapter } from "./slm/slmAdapter.js";

const AssistAnnotation = Annotation.Root({
  transcript: Annotation<string>,
  mapGraph: Annotation<DirectedMapGraph>(),
  nextMove: Annotation<string | null>(),
});

export type AssistState = typeof AssistAnnotation.State;

export const buildAssistGraph = (slm: SlmAdapter) => {
  const cartographer = (state: AssistState): Partial<AssistState> => {
    const merged = mergeGraphFromTranscript(
      state.mapGraph ?? createEmptyGraph(),
      state.transcript,
    );
    return { mapGraph: merged };
  };

  const navigatorNode = async (
    state: AssistState,
  ): Promise<Partial<AssistState>> => {
    const g = state.mapGraph ?? createEmptyGraph();
    try {
      const hint = await slm.completeNavigatorMove({
        transcript: state.transcript,
        mapJson: graphToJson(g),
      });
      const upper = hint.nextMoveUpper?.trim() ?? null;
      if (upper === null || upper === "") {
        return { nextMove: null };
      }
      const letter = upper[0]?.toUpperCase() ?? null;
      return { nextMove: letter };
    } catch {
      const d = chooseNextExplorationMove(g);
      return { nextMove: d === null ? null : d.toUpperCase() };
    }
  };

  const graph = new StateGraph(AssistAnnotation)
    .addNode("cartographer", cartographer)
    .addNode("navigator", navigatorNode)
    .addEdge(START, "cartographer")
    .addEdge("cartographer", "navigator")
    .addEdge("navigator", END);

  return graph.compile();
};

export type CompiledAssistGraph = ReturnType<typeof buildAssistGraph>;

export const runAssistStep = async (
  compiled: CompiledAssistGraph,
  input: AssistState,
): Promise<{
  readonly mapGraph: DirectedMapGraph;
  readonly nextMove: string | null;
  readonly mermaid: string;
  readonly mapJson: unknown;
}> => {
  const out = await compiled.invoke({
    transcript: input.transcript,
    mapGraph: input.mapGraph ?? createEmptyGraph(),
    nextMove: input.nextMove ?? null,
  });
  const mapGraph = out.mapGraph ?? createEmptyGraph();
  return {
    mapGraph,
    nextMove: out.nextMove ?? null,
    mermaid: directedGraphToMermaidFlowchart(mapGraph),
    mapJson: graphToJson(mapGraph),
  };
};
