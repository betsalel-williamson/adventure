import type { CompassToken, DirectedMapGraph } from "./directedGraph.js";

const SEARCH_ORDER: readonly CompassToken[] = ["n", "e", "s", "w", "u", "d"];

const hasOutgoing = (
  g: DirectedMapGraph,
  fromId: NonNullable<DirectedMapGraph["currentPlaceId"]>,
  move: CompassToken,
): boolean =>
  g.committedEdges.some((e) => e.fromId === fromId && e.move === move);

/**
 * Deterministic navigator: prefer first missing compass direction from current node,
 * otherwise from any known place (stable order).
 */
export const chooseNextExplorationMove = (
  g: DirectedMapGraph,
): CompassToken | null => {
  const tryFrom = (
    placeId: NonNullable<DirectedMapGraph["currentPlaceId"]>,
  ): CompassToken | null => {
    for (const d of SEARCH_ORDER) {
      if (!hasOutgoing(g, placeId, d)) {
        return d;
      }
    }
    return null;
  };

  if (g.currentPlaceId) {
    const fromCurrent = tryFrom(g.currentPlaceId);
    if (fromCurrent) {
      return fromCurrent;
    }
  }

  const orderedIds = [...g.places.map((p) => p.id)].sort();
  for (const pid of orderedIds) {
    const mv = tryFrom(pid);
    if (mv !== null) {
      return mv;
    }
  }

  return null;
};
