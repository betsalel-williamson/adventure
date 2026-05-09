import { z } from "zod";

export const checkpointRefSchema = z.object({
  checkpointId: z.string().min(1),
  runId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  replayInputRef: z.string().min(1),
  createdAt: z.string().min(1)
});

export type CheckpointRef = z.infer<typeof checkpointRefSchema>;

export const replayControlPhaseSchema = z.enum([
  "act",
  "think",
  "test",
  "chaos",
  "disorder"
]);

export const replayRestorePayloadSchema = z.object({
  checkpointId: z.string().min(1),
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  replayInputRef: z.string().min(1),
  controlPhase: replayControlPhaseSchema,
  pendingOracleSequence: z.number().int().nonnegative().nullable(),
  restoredAt: z.string().min(1)
});

export type ReplayRestorePayload = z.infer<typeof replayRestorePayloadSchema>;

