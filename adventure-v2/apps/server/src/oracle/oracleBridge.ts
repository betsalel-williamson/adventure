import type { OracleObservationOutcome } from "../../../../packages/contracts/src/index.js";

export type OracleObservationInput = {
  runId: string;
  turnId: string;
  sequence: number;
  action: string;
  forceReject?: boolean;
};

export type OracleObservationResult = {
  rejected: boolean;
  output: string;
  outcome: OracleObservationOutcome;
  stderrExcerpt?: string;
};

export type OracleBridge = {
  observe(input: OracleObservationInput): OracleObservationResult | Promise<OracleObservationResult>;
  /** Release subprocesses or other resources held by the bridge (optional). */
  shutdown?(): void | Promise<void>;
};

/** Tear down bridges that expose `shutdown` (no-op for synthetic / one-shot process bridges). */
export const shutdownOracleBridge = async (bridge: OracleBridge): Promise<void> => {
  if (typeof bridge.shutdown === "function") {
    await bridge.shutdown();
  }
};

/**
 * Aligns `rejected` with `outcome` when a bridge or subprocess emits contradictory flags
 * (so control policy and reconcile classification stay consistent on the same turn).
 */
export const normalizeOracleObservation = (obs: OracleObservationResult): OracleObservationResult => {
  const { outcome } = obs;
  let rejected = obs.rejected;
  if (outcome === "transport_error") {
    rejected = true;
  } else if (outcome === "accepted") {
    rejected = false;
  } else if (outcome === "rejected") {
    rejected = true;
  }
  if (rejected === obs.rejected) {
    return obs;
  }
  return { ...obs, rejected };
};

export const createSyntheticOracleBridge = (): OracleBridge => ({
  observe(input) {
    const rejected = Boolean(input.forceReject);
    return {
      rejected,
      output: rejected ? "I do not understand that." : "OK.",
      outcome: rejected ? "rejected" : "accepted"
    };
  }
});
