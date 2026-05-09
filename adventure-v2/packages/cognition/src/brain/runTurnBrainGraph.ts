import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { CognitionTraceWire } from "../../../contracts/src/http/wire.js";
import { buildPlanPromptBundle } from "../prompts/adventureAgentPrompts.js";
import { capPromptTextForWire, digestUtf8, firstLineExcerpt } from "./promptDigest.js";

const BrainAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  turnId: Annotation<string>(),
  sequence: Annotation<number>(),
  rawInput: Annotation<string>(),
  action: Annotation<string>(),
  traces: Annotation<CognitionTraceWire[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => []
  })
});

const now = (): string => new Date().toISOString();

const perceiveNode = (state: typeof BrainAnnotation.State): Partial<typeof BrainAnnotation.State> => {
  const trace: CognitionTraceWire = {
    runId: state.runId,
    turnId: state.turnId,
    sequence: state.sequence,
    nodeId: "perceive",
    graphNodeId: "perceive",
    stepIndex: 0,
    label: "Perceive user input",
    ts: now(),
    payload: { rawLength: state.rawInput.length }
  };
  return { traces: [trace] };
};

const planNode = (state: typeof BrainAnnotation.State): Partial<typeof BrainAnnotation.State> => {
  const bundle = buildPlanPromptBundle(state.rawInput);
  const combined = `${bundle.system}\n---\n${bundle.user}`;
  const trace: CognitionTraceWire = {
    runId: state.runId,
    turnId: state.turnId,
    sequence: state.sequence,
    nodeId: "plan",
    graphNodeId: "plan",
    stepIndex: 1,
    label: "Plan (stub prompts)",
    ts: now(),
    promptDigest: digestUtf8(combined),
    promptSummary: firstLineExcerpt(bundle.system),
    promptRole: "system",
    promptSystem: capPromptTextForWire(bundle.system),
    promptUser: capPromptTextForWire(bundle.user),
    payload: {
      planPromptUserDigest: digestUtf8(bundle.user),
      planPromptUserSummary: firstLineExcerpt(bundle.user)
    }
  };
  return { traces: [trace] };
};

const actNode = (state: typeof BrainAnnotation.State): Partial<typeof BrainAnnotation.State> => {
  const action = state.rawInput.trim();
  const trace: CognitionTraceWire = {
    runId: state.runId,
    turnId: state.turnId,
    sequence: state.sequence,
    nodeId: "act",
    graphNodeId: "act",
    stepIndex: 2,
    label: "Act — propose oracle command",
    ts: now(),
    payload: { action }
  };
  return { action, traces: [trace] };
};

const graphBuilder = new StateGraph(BrainAnnotation)
  .addNode("perceive", perceiveNode)
  .addNode("plan", planNode)
  .addNode("act", actNode)
  .addEdge(START, "perceive")
  .addEdge("perceive", "plan")
  .addEdge("plan", "act")
  .addEdge("act", END);

const compiledBrainGraph = graphBuilder.compile();

export type TurnBrainInput = {
  runId: string;
  turnId: string;
  sequence: number;
  rawInput: string;
};

export const runTurnBrainGraph = async (
  input: TurnBrainInput
): Promise<{ action: string; traces: CognitionTraceWire[] }> => {
  const out = await compiledBrainGraph.invoke({
    runId: input.runId,
    turnId: input.turnId,
    sequence: input.sequence,
    rawInput: input.rawInput,
    action: "",
    traces: []
  });
  return {
    action: out.action,
    traces: out.traces
  };
};
