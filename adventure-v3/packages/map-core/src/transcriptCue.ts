import type { CompassToken } from "./directedGraph.js";

const ECHO_LINE = /^> (.+)$/;

export const lineStartsWithYouAre = (line: string): boolean =>
  /^\s*YOU ARE\b/i.test(line);

export const isEchoLine = (line: string): boolean => ECHO_LINE.test(line);

export const parseEchoCommand = (line: string): string | null => {
  const m = ECHO_LINE.exec(line);
  return m?.[1]?.trim() ?? null;
};

/**
 * First letter / word compass tokens accepted by Colossal Cave style play.
 */
export const parseCompassToken = (cmd: string): CompassToken | null => {
  const u = cmd.trim().toUpperCase();
  if (u.length === 0) {
    return null;
  }
  const c = u[0]!;
  if (
    c === "N" ||
    c === "E" ||
    c === "S" ||
    c === "W" ||
    c === "U" ||
    c === "D"
  ) {
    return c.toLowerCase() as CompassToken;
  }
  const head = u.split(/\s+/)[0] ?? "";
  if (head === "NORTH") return "n";
  if (head === "EAST") return "e";
  if (head === "SOUTH") return "s";
  if (head === "WEST") return "w";
  if (head === "UP") return "u";
  if (head === "DOWN") return "d";
  return null;
};

/**
 * Last YOU ARE line and the move echo that precedes it (if any) in document order.
 */
export const extractLastNavigationContext = (
  transcript: string,
): { lastMove: CompassToken | null; youAreEvidence: string | null } => {
  const lines = transcript.split(/\r?\n/);
  let lastMove: CompassToken | null = null;
  let youAreEvidence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const echo = parseEchoCommand(line);
    if (echo !== null) {
      lastMove = parseCompassToken(echo);
      continue;
    }
    if (!isEchoLine(line) && lineStartsWithYouAre(line)) {
      const t = line.trim();
      if (t.length > 0) {
        youAreEvidence = t;
      }
    }
  }

  return { lastMove, youAreEvidence };
};
