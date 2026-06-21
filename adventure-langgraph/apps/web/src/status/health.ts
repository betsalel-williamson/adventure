export type HealthWireBody = {
  oracleMode?: string;
  processOracleScript?: string | null;
};

/** Short label for a subdued footer — no URLs or jargon. */
export const minimalOracleHint = (
  body: HealthWireBody | null,
  opts: { fetchError?: string },
): string => {
  if (opts.fetchError) {
    return "API unreachable";
  }
  if (!body) {
    return "Unknown engine";
  }
  if (body.oracleMode === "process") {
    return "Fortran game";
  }
  return "Demo oracle";
};

/**
 * Single compact status line for the bezel (US-2-1 — plain language).
 */
export const describeHealthStatus = (
  body: HealthWireBody | null,
  opts: { fetchError?: string },
): string => {
  if (opts.fetchError) {
    return `Not connected — ${opts.fetchError}`;
  }
  if (!body) {
    return "API status unknown.";
  }
  if (body.oracleMode === "process") {
    const script = body.processOracleScript?.trim();
    return script && script.length > 0
      ? `Game engine: Fortran subprocess (${script}).`
      : "Game engine: process oracle (Fortran bridge).";
  }
  return "Game engine: demo/test mode (not the Fortran binary — output may look like “OK.”).";
};
