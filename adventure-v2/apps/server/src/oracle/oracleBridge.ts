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
};

export type OracleBridge = {
  observe(input: OracleObservationInput): OracleObservationResult;
};

export const createSyntheticOracleBridge = (): OracleBridge => ({
  observe(input) {
    const rejected = Boolean(input.forceReject);
    return {
      rejected,
      output: rejected ? "I do not understand that." : "OK."
    };
  }
});
