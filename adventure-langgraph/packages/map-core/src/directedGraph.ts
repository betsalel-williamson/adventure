/**
 * Directed graph model for draft cave maps: places as vertices, compass moves as labeled arcs.
 *
 * Reading (optional): Tim Maudlin, "New Foundations for Physical Geometry: The Theory of
 * Linear Structures" (OUP, 2014) motivates representing navigable structure via primitive
 * directed relations between parts rather than a coordinate canvas. This module is the
 * engineering analogue: edges are observed move tokens, not ground truth from the engine.
 */

export type PlaceId = `p${number}`;

export type CompassToken = "n" | "e" | "s" | "w" | "u" | "d";

/** Observed transition — only written when transcript + move history support it. */
export type CommittedEdge = {
  readonly fromId: PlaceId;
  readonly toId: PlaceId;
  readonly move: CompassToken;
};

export type MapPlace = {
  readonly id: PlaceId;
  /** Oracle-facing room line (e.g. YOU ARE …), trimmed. */
  readonly evidence: string;
};

export type DirectedMapGraph = {
  readonly places: readonly MapPlace[];
  readonly committedEdges: readonly CommittedEdge[];
  /** Current place after the latest parsed observation, if any. */
  readonly currentPlaceId: PlaceId | null;
  /** Monotonic counter for synthetic ids (p0, p1, …). */
  readonly nextPlaceIndex: number;
};

export const createEmptyGraph = (): DirectedMapGraph => ({
  places: [],
  committedEdges: [],
  currentPlaceId: null,
  nextPlaceIndex: 0,
});

export const graphToJson = (g: DirectedMapGraph): unknown => ({
  places: g.places,
  committedEdges: g.committedEdges,
  currentPlaceId: g.currentPlaceId,
  nextPlaceIndex: g.nextPlaceIndex,
});
