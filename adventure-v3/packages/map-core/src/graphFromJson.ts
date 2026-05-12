import { z } from "zod";
import type {
  CommittedEdge,
  CompassToken,
  DirectedMapGraph,
  PlaceId,
} from "./directedGraph.js";
import { createEmptyGraph } from "./directedGraph.js";

const compass = z.enum(["n", "e", "s", "w", "u", "d"]);

const placeSchema = z.object({
  id: z.string(),
  evidence: z.string(),
});

const edgeSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  move: compass,
});

const directedMapGraphJsonSchema = z.object({
  places: z.array(placeSchema),
  committedEdges: z.array(edgeSchema),
  currentPlaceId: z.string().nullable(),
  nextPlaceIndex: z.number(),
});

/**
 * Parse assist / API JSON into a graph; returns null if validation fails.
 */
export const parseDirectedMapGraphFromJson = (
  raw: unknown,
): DirectedMapGraph | null => {
  const p = directedMapGraphJsonSchema.safeParse(raw);
  if (!p.success) {
    return null;
  }
  const d = p.data;
  return {
    places: d.places.map((x) => ({
      id: x.id as PlaceId,
      evidence: x.evidence,
    })),
    committedEdges: d.committedEdges.map(
      (x) =>
        ({
          fromId: x.fromId as PlaceId,
          toId: x.toId as PlaceId,
          move: x.move as CompassToken,
        }) satisfies CommittedEdge,
    ),
    currentPlaceId:
      d.currentPlaceId === null ? null : (d.currentPlaceId as PlaceId),
    nextPlaceIndex: d.nextPlaceIndex,
  };
};

/** Empty graph guard for callers that expect a value. */
export const parseDirectedMapGraphFromJsonOrEmpty = (
  raw: unknown,
): DirectedMapGraph => parseDirectedMapGraphFromJson(raw) ?? createEmptyGraph();
