import type { SseWireEvent, TurnEnvelope } from "@contracts";

/** User echo after Send — classic `>` prompt; caps match shell presentation. */
export const formatUserEchoLine = (input: string): string => {
  const t = input.trim().toUpperCase();
  return t ? `> ${t}` : "";
};

/**
 * Fortran / bridge output often includes runs of `\n` (paragraph spacing from the original program).
 * `<pre>` + `pre-wrap` preserves each one as a full line at line-height, so 3+ newlines read as huge gaps.
 */
export const normalizeOracleOutputLineBreaks = (text: string): string => {
  const unified = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return unified.replace(/\n{3,}/g, "\n\n");
};

/**
 * Map an oracle envelope to readable CRT text (game lane only).
 */
export const oracleObservationText = (env: TurnEnvelope): string | null => {
  if (env.kind !== "oracle_observation") {
    return null;
  }
  const output = env.payload.output;
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  return normalizeOracleOutputLineBreaks(text).replace(/\s+$/, "");
};

export const virtualTerminalChunkFromEnvelope = (env: TurnEnvelope): string | null => {
  if (env.kind === "proposal") {
    const action =
      typeof env.payload.action === "string" ? env.payload.action : String(env.payload.action ?? "?");
    return `[agent] ${action}`;
  }
  return oracleObservationText(env);
};

export const virtualTerminalChunkFromWire = (wire: SseWireEvent): string | null => {
  if (wire.event !== "turn") {
    return null;
  }
  return virtualTerminalChunkFromEnvelope(wire.envelope);
};
