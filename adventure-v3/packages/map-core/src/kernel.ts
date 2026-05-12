import type {
  CommittedEdge,
  CompassToken,
  DirectedMapGraph,
  MapPlace,
  PlaceId,
} from "./directedGraph.js";
import {
  lineStartsWithYouAre,
  parseEchoCommand,
  parseCompassToken,
  isEchoLine,
} from "./transcriptCue.js";

const syntheticId = (index: number): PlaceId => `p${index}` as PlaceId;

const findPlaceByEvidence = (
  places: readonly MapPlace[],
  evidence: string,
): MapPlace | undefined => places.find((p) => p.evidence === evidence);

const hasOutgoingEdge = (
  edges: readonly CommittedEdge[],
  fromId: PlaceId,
  move: CompassToken,
): boolean => edges.some((e) => e.fromId === fromId && e.move === move);

/**
 * Recompute graph place + committed edges from the full CRT transcript only.
 * Committed edges exist only when we see both a compass echo and a subsequent YOU ARE.
 */
export const mergeGraphFromTranscript = (
  previous: DirectedMapGraph,
  transcript: string,
): DirectedMapGraph => {
  const trimmed = transcript.trim();
  if (trimmed === "") {
    return previous;
  }

  let places = [...previous.places];
  let edges = [...previous.committedEdges];
  let nextIdx = previous.nextPlaceIndex;
  let currentPlaceId = previous.currentPlaceId;

  const lines = transcript.split(/\r?\n/);
  let pendingMoveAfterEcho: CompassToken | null = null;

  const ensurePlace = (evidence: string): PlaceId => {
    const existing = findPlaceByEvidence(places, evidence);
    if (existing) {
      return existing.id;
    }
    const id = syntheticId(nextIdx);
    nextIdx += 1;
    places = [...places, { id, evidence }];
    return id;
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const echoCmd = parseEchoCommand(line);
    if (echoCmd !== null) {
      pendingMoveAfterEcho = parseCompassToken(echoCmd);
      continue;
    }
    if (isEchoLine(line)) {
      continue;
    }
    if (!lineStartsWithYouAre(line)) {
      continue;
    }

    const evidence = line.trim();
    if (!evidence) {
      continue;
    }

    const placeId = ensurePlace(evidence);

    if (currentPlaceId === null) {
      currentPlaceId = placeId;
      pendingMoveAfterEcho = null;
      continue;
    }

    const move = pendingMoveAfterEcho;
    pendingMoveAfterEcho = null;

    if (move === null) {
      /** YOU ARE without a preceding compass echo on this slice (e.g. look). */
      currentPlaceId = placeId;
      continue;
    }

    const fromId = currentPlaceId;
    if (!hasOutgoingEdge(edges, fromId, move)) {
      edges = [
        ...edges,
        { fromId, toId: placeId, move } satisfies CommittedEdge,
      ];
    }

    currentPlaceId = placeId;
  }

  return {
    places,
    committedEdges: edges,
    currentPlaceId,
    nextPlaceIndex: nextIdx,
  };
};
