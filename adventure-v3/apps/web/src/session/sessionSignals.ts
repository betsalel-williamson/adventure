/**
 * Session signals derived only from CRT transcript text (pure; testable without DOM).
 */

import { CRT_AWAITING_ORACLE_PLACEHOLDER } from "../transcript/constants.js";

export const RECENT_MOVES_LIMIT = 5;
export const LOCATION_CUE_MAX_CHARS = 72;

/** User echo line from virtualTerminal.formatUserEchoLine — "> COMMAND". */
const ECHO_LINE = /^> (.+)$/;

export type SessionSignalsPhase = "waiting" | "ready";

export type DerivedSessionSignals = {
  phase: SessionSignalsPhase;
  /** Command verbs from echo lines, oldest dropped when over limit */
  recentMoves: string[];
  /** Lines mentioning location-style oracle prose */
  locationCues: string[];
};

const trimCue = (line: string): string => {
  const t = line.trim();
  if (t.length <= LOCATION_CUE_MAX_CHARS) {
    return t;
  }
  return `${t.slice(0, LOCATION_CUE_MAX_CHARS - 1)}…`;
};

export const extractRecentMoves = (lines: readonly string[]): string[] => {
  const buf: string[] = [];
  for (const line of lines) {
    const m = ECHO_LINE.exec(line);
    if (m) {
      const cmd = m[1]?.trim();
      if (cmd) {
        buf.push(cmd);
        if (buf.length > RECENT_MOVES_LIMIT) {
          buf.shift();
        }
      }
    }
  }
  return buf;
};

const isEchoLine = (line: string): boolean => ECHO_LINE.test(line);

/** Adventure-style location line — start with YOU ARE (avoids prose like “WITHOUT YOU ARE”). */
const lineStartsWithYouAre = (line: string): boolean =>
  /^\s*YOU ARE\b/i.test(line);

export const extractLocationCues = (lines: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (isEchoLine(line)) {
      continue;
    }
    const t = line.trim();
    if (!t || !lineStartsWithYouAre(line)) {
      continue;
    }
    const cue = trimCue(t);
    if (!seen.has(cue)) {
      seen.add(cue);
      out.push(cue);
      if (out.length >= RECENT_MOVES_LIMIT) {
        break;
      }
    }
  }
  return out;
};

export const deriveSessionSignals = (
  transcript: string,
): DerivedSessionSignals => {
  const trimmed = transcript.trim();
  if (trimmed === "" || trimmed === CRT_AWAITING_ORACLE_PLACEHOLDER) {
    return { phase: "waiting", recentMoves: [], locationCues: [] };
  }

  const lines = transcript.split(/\r?\n/);
  return {
    phase: "ready",
    recentMoves: extractRecentMoves(lines),
    locationCues: extractLocationCues(lines),
  };
};

export const formatSessionSignalsForPanel = (
  d: DerivedSessionSignals,
): string[] => {
  if (d.phase === "waiting") {
    return ["Waiting for game text…"];
  }

  const lines: string[] = [];
  if (d.recentMoves.length > 0) {
    lines.push(`Recent moves: ${d.recentMoves.join(", ")}`);
  }
  if (d.locationCues.length > 0) {
    lines.push("Mentioned in game text:");
    for (const cue of d.locationCues) {
      lines.push(`· ${cue}`);
    }
  }
  if (lines.length === 0) {
    lines.push("No session cues yet — keep playing.");
  }
  return lines;
};
