/**
 * Pure helpers for the CRT game terminal lane (placeholder until first oracle output).
 */

import { appendTranscriptLine } from "./shellState.js";

/** Initial / idle copy until the stream delivers `oracle_observation` content. */
export const GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER =
  "(Waiting for oracle/game output — send a command. Default dev API uses a synthetic oracle unless you configure a process/Fortran bridge — see README.)";

export type GameTerminalChunkKind = "user_echo" | "proposal" | "oracle" | "meta";

/**
 * Append one virtual-terminal line. Oracle chunks strip the leading wait placeholder once.
 */
export const appendGameTerminalVirtualLine = (
  previous: string,
  line: string,
  opts: { awaitingOracleObservation: boolean; chunkKind: GameTerminalChunkKind }
): { text: string; awaitingOracleObservation: boolean } => {
  const ph = GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER;
  let base = previous;
  let awaiting = opts.awaitingOracleObservation;

  if (opts.chunkKind === "oracle") {
    if (base === ph) {
      base = "";
    } else if (base.startsWith(`${ph}\n`)) {
      base = base.slice(ph.length + 1);
    }
    awaiting = false;
  }

  return {
    text: appendTranscriptLine(base, line),
    awaitingOracleObservation: awaiting
  };
};
