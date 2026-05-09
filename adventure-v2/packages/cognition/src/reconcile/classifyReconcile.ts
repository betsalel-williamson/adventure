import type { OracleObservationOutcome, ReconcileOutcome } from "../../../contracts/src/index.js";

type ObservationForReconcile = {
  rejected: boolean;
  output: string;
  outcome: OracleObservationOutcome;
  stderrExcerpt?: string;
};

type ReconcileInput = {
  runId: string;
  turnId: string;
  sequence: number;
  observation: ObservationForReconcile;
};

const excerpt = (s: string, max = 200): string => {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
};

export const classifyReconcile = (input: ReconcileInput): ReconcileOutcome => {
  const correlationId = input.turnId;
  const outputExcerpt = excerpt(input.observation.output);

  if (input.observation.outcome === "transport_error") {
    return {
      runId: input.runId,
      turnId: input.turnId,
      sequence: input.sequence,
      driftDetected: true,
      driftClass: "unknown",
      beliefPatch: { oracleTransportError: true },
      confidenceBefore: 0.8,
      confidenceAfter: 0.45,
      nextPolicy: "test",
      correlationId,
      driftSummary: "Oracle transport or harness failure; transcript may be incomplete.",
      evidence: {
        oracleOutcome: "transport_error",
        outputExcerpt
      }
    };
  }

  if (input.observation.outcome === "rejected") {
    return {
      runId: input.runId,
      turnId: input.turnId,
      sequence: input.sequence,
      driftDetected: true,
      driftClass: "parser",
      beliefPatch: { parserRejected: true },
      confidenceBefore: 0.8,
      confidenceAfter: 0.5,
      nextPolicy: "test",
      correlationId,
      driftSummary: "Oracle rejected the proposed action.",
      evidence: {
        oracleOutcome: "rejected",
        outputExcerpt
      }
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
    nextPolicy: "continue",
    correlationId,
    evidence: {
      oracleOutcome: "accepted",
      outputExcerpt
    }
  };
};
