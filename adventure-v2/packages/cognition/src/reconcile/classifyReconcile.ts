import type { ReconcileOutcome } from "../../../contracts/src/index.js";

type ReconcileInput = {
  runId: string;
  turnId: string;
  sequence: number;
  oracleRejected: boolean;
};

export const classifyReconcile = (input: ReconcileInput): ReconcileOutcome => {
  if (input.oracleRejected) {
    return {
      runId: input.runId,
      turnId: input.turnId,
      sequence: input.sequence,
      driftDetected: true,
      driftClass: "parser",
      beliefPatch: { parserRejected: true },
      confidenceBefore: 0.8,
      confidenceAfter: 0.5,
      nextPolicy: "test"
    };
  }

  return {
    runId: input.runId,
    turnId: input.turnId,
    sequence: input.sequence,
    driftDetected: false,
    driftClass: "none",
    beliefPatch: {},
    confidenceBefore: 0.8,
    confidenceAfter: 0.85,
    nextPolicy: "continue"
  };
};

