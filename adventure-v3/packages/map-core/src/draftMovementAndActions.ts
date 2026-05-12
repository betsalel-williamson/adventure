import type {
  CompassToken,
  DirectedMapGraph,
  PlaceId,
} from "./directedGraph.js";
import {
  extractRecentMoves,
  lineStartsWithYouAre,
  parseCompassToken,
  parseEchoCommand,
  isEchoLine,
} from "./transcriptCue.js";
import { shortRoomLabel } from "./draftRoomLabel.js";

const COMPASS_DISPLAY: Record<CompassToken, string> = {
  n: "North",
  e: "East",
  s: "South",
  w: "West",
  u: "Up",
  d: "Down",
};

const SEARCH_ORDER: readonly CompassToken[] = ["n", "e", "s", "w", "u", "d"];

export type KnownExit = {
  readonly kind: "known";
  readonly direction: CompassToken;
  readonly directionLabel: string;
  readonly toPlaceId: PlaceId;
  readonly toLabel: string;
};

export type UntriedCompass = {
  readonly kind: "untried";
  readonly direction: CompassToken;
  readonly directionLabel: string;
};

export const formatCompassDisplay = (d: CompassToken): string =>
  COMPASS_DISPLAY[d] ?? d.toUpperCase();

/**
 * Known exits from the current place plus compass directions not yet observed from here.
 */
export const movementOptionsFromCurrentPlace = (
  g: DirectedMapGraph,
): { readonly known: KnownExit[]; readonly untried: UntriedCompass[] } => {
  const cur = g.currentPlaceId;
  if (!cur) {
    return { known: [], untried: [] };
  }

  const known: KnownExit[] = [];
  const tried = new Set<CompassToken>();

  for (const e of g.committedEdges) {
    if (e.fromId !== cur) {
      continue;
    }
    tried.add(e.move);
    const dest = g.places.find((p) => p.id === e.toId);
    known.push({
      kind: "known",
      direction: e.move,
      directionLabel: formatCompassDisplay(e.move),
      toPlaceId: e.toId,
      toLabel: shortRoomLabel(dest?.evidence ?? e.toId),
    });
  }

  const untried: UntriedCompass[] = [];
  for (const d of SEARCH_ORDER) {
    if (!tried.has(d)) {
      untried.push({
        kind: "untried",
        direction: d,
        directionLabel: formatCompassDisplay(d),
      });
    }
  }

  return { known, untried };
};

/**
 * Commands from the transcript that are not plain compass moves — "actions to try" hints.
 * Uses recent echoed lines newest-first uniqueness cap.
 */
export const nonCompassCommandsFromTranscript = (
  transcript: string,
  maxUnique = 10,
): string[] => {
  const lines = transcript.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const cmd = parseEchoCommand(lines[i] ?? "");
    if (cmd === null) {
      continue;
    }
    const u = cmd.trim().toUpperCase();
    if (!u || parseCompassToken(cmd) !== null) {
      continue;
    }
    if (seen.has(u)) {
      continue;
    }
    seen.add(u);
    out.unshift(u);
    if (out.length >= maxUnique) {
      break;
    }
  }

  return out;
};

/**
 * Last YOU ARE oracle line in transcript — for "you are here" banner (may differ slightly from graph evidence).
 */
export const lastYouAreLineFromTranscript = (
  transcript: string,
): string | null => {
  const lines = transcript.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (!isEchoLine(line) && lineStartsWithYouAre(line)) {
      const t = line.trim();
      return t.length ? t : null;
    }
  }
  return null;
};

/** Re-export for panels that already show moves list */
export const recentMoveCommands = (transcript: string): string[] =>
  extractRecentMoves(transcript.split(/\r?\n/));
