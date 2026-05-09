import type { CognitionTraceWire } from "../../../contracts/src/http/wire.js";
import type { ReconcileOutcome } from "../../../contracts/src/reconcile/outcome.js";

const now = (): string => new Date().toISOString();

/** SSE trace row for the post-oracle reconcile step (outside the pre-oracle LangGraph). */
export const buildReconcileTrace = (params: {
  runId: string;
  turnId: string;
  sequence: number;
  reconcile: ReconcileOutcome;
}): CognitionTraceWire => ({
  runId: params.runId,
  turnId: params.turnId,
  sequence: params.sequence,
  nodeId: "reconcile",
  graphNodeId: "reconcile",
  stepIndex: 3,
  label: "Reconcile observation vs belief",
  ts: now(),
  payload: {
    driftClass: params.reconcile.driftClass,
    nextPolicy: params.reconcile.nextPolicy,
    driftDetected: params.reconcile.driftDetected
  }
});
