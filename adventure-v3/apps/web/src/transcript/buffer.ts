/**
 * Append-only CRT transcript lines (pure; testable without DOM).
 */

import { CRT_AWAITING_ORACLE_PLACEHOLDER } from "./constants.js";

export const appendTranscriptLine = (previous: string, line: string): string =>
  previous ? `${previous}\n${line}` : line;

export type OracleAppendResult = {
  text: string;
  awaitingOracle: boolean;
};

/**
 * Strips the wait placeholder when the first oracle chunk arrives.
 */
export const appendOracleAwareLine = (
  previous: string,
  line: string,
  opts: { awaitingOracle: boolean; isOracleChunk: boolean }
): OracleAppendResult => {
  const ph = CRT_AWAITING_ORACLE_PLACEHOLDER;
  let base = previous;
  let awaiting = opts.awaitingOracle;

  if (opts.isOracleChunk) {
    if (base === ph) {
      base = "";
    } else if (base.startsWith(`${ph}\n`)) {
      base = base.slice(ph.length + 1);
    }
    awaiting = false;
  }

  return {
    text: appendTranscriptLine(base, line),
    awaitingOracle: awaiting
  };
};
