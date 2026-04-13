import { z } from "zod";

/** Host-supplied inferred map snapshot (validated loosely for forward compatibility). */
export const inferredMapSnapshotInputSchema = z
  .object({
    current: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    currentGraphNodeId: z.string(),
    lastFingerprint: z.string().nullable().optional(),
    cells: z.array(z.unknown()),
    exitOutcomes: z.record(z.string(), z.unknown()),
    directedEdges: z.array(z.unknown()),
    triedCommandsByNode: z.record(z.string(), z.unknown()),
    nonLocationActionsByNode: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type InferredMapSnapshotInput = z.infer<
  typeof inferredMapSnapshotInputSchema
>;
