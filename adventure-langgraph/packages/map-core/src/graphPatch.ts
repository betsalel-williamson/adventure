import { z } from "zod";
import type {
  CommittedEdge,
  CompassToken,
  DirectedMapGraph,
  MapPlace,
  PlaceId,
} from "./directedGraph.js";

const compassTokenSchema = z.enum(["n", "e", "s", "w", "u", "d"]);

const placeIdSchema = z.custom<PlaceId>(
  (v) => typeof v === "string" && /^p\d+$/.test(v),
);

export const locationGraphPatchSchema = z.object({
  place: z
    .object({
      id: placeIdSchema.optional(),
      evidence: z.string().min(1),
    })
    .optional(),
  edge: z
    .object({
      fromId: placeIdSchema,
      toId: placeIdSchema,
      move: compassTokenSchema,
    })
    .optional(),
  currentPlaceId: placeIdSchema.nullable().optional(),
});

export type LocationGraphPatch = z.infer<typeof locationGraphPatchSchema>;

export type LocationIngestContext = {
  readonly priorLines: readonly string[];
  readonly currentPlaceId: PlaceId | null;
};

const findPlaceByEvidence = (
  places: readonly MapPlace[],
  evidence: string,
): MapPlace | undefined => places.find((p) => p.evidence === evidence);

const findPlaceById = (
  places: readonly MapPlace[],
  id: PlaceId,
): MapPlace | undefined => places.find((p) => p.id === id);

const hasOutgoingEdge = (
  edges: readonly CommittedEdge[],
  fromId: PlaceId,
  move: CompassToken,
): boolean => edges.some((e) => e.fromId === fromId && e.move === move);

/**
 * Apply a validated location patch onto an existing graph (draft assist only).
 */
export const applyLocationGraphPatch = (
  previous: DirectedMapGraph,
  patch: LocationGraphPatch,
): DirectedMapGraph => {
  let places = [...previous.places];
  let edges = [...previous.committedEdges];
  let nextIdx = previous.nextPlaceIndex;
  let currentPlaceId = previous.currentPlaceId;

  const ensurePlace = (evidence: string, id?: PlaceId): PlaceId => {
    if (id !== undefined) {
      const byId = findPlaceById(places, id);
      if (byId) {
        return byId.id;
      }
      places = [...places, { id, evidence }];
      return id;
    }
    const existing = findPlaceByEvidence(places, evidence);
    if (existing) {
      return existing.id;
    }
    const newId = `p${nextIdx}` as PlaceId;
    nextIdx += 1;
    places = [...places, { id: newId, evidence }];
    return newId;
  };

  if (patch.place !== undefined) {
    const placeId = ensurePlace(patch.place.evidence, patch.place.id);
    if (currentPlaceId === null) {
      currentPlaceId = placeId;
    }
  }

  if (patch.edge !== undefined) {
    const { fromId, toId, move } = patch.edge;
    if (!hasOutgoingEdge(edges, fromId, move)) {
      edges = [...edges, { fromId, toId, move }];
    }
    currentPlaceId = toId;
  }

  if (patch.currentPlaceId !== undefined) {
    currentPlaceId = patch.currentPlaceId;
  }

  return {
    places,
    committedEdges: edges,
    currentPlaceId,
    nextPlaceIndex: nextIdx,
  };
};

export const parseLocationGraphPatch = (
  input: unknown,
): LocationGraphPatch | null => {
  const parsed = locationGraphPatchSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};

const directedMapGraphSchema = z.object({
  places: z.array(
    z.object({
      id: placeIdSchema,
      evidence: z.string(),
    }),
  ),
  committedEdges: z.array(
    z.object({
      fromId: placeIdSchema,
      toId: placeIdSchema,
      move: compassTokenSchema,
    }),
  ),
  currentPlaceId: placeIdSchema.nullable(),
  nextPlaceIndex: z.number().int().nonnegative(),
});

export const parseDirectedMapGraph = (
  input: unknown,
): DirectedMapGraph | null => {
  const parsed = directedMapGraphSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};
