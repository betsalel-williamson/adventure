import { z } from "zod";
import { runConfigSchema } from "../api/run.js";
import { checkpointRefSchema, replayRestorePayloadSchema } from "../checkpoints/checkpoint.js";
import { turnEnvelopeSchema } from "../events/turn.js";

/** JSON body for `GET /runs/:runId/checkpoints`. */
export const listCheckpointsResponseSchema = z.array(checkpointRefSchema);
export type ListCheckpointsResponse = z.infer<typeof listCheckpointsResponseSchema>;

/** JSON body for `POST /runs/:runId/replay`. */
export const postReplayRequestSchema = z.object({
  checkpointId: z.string().min(1)
});

export type PostReplayRequest = z.infer<typeof postReplayRequestSchema>;

/** Response body mirrors `replayRestorePayloadSchema` (validated on send). */
export const postReplayResponseSchema = replayRestorePayloadSchema;
export type PostReplayResponse = z.infer<typeof postReplayResponseSchema>;

/** Control phase labels (wire); aligns with packages/control PhaseTransitionEvent. */
export const controlPhaseWireSchema = z.enum(["act", "think", "test", "chaos", "disorder"]);
export type ControlPhaseWire = z.infer<typeof controlPhaseWireSchema>;

export const phaseTransitionWireSchema = z.object({
  from: controlPhaseWireSchema,
  to: controlPhaseWireSchema,
  reason: z.string(),
  sequence: z.number().int().nonnegative(),
  ts: z.string().min(1)
});

export type PhaseTransitionWire = z.infer<typeof phaseTransitionWireSchema>;

export const createRunRequestSchema = z.object({
  config: runConfigSchema
});

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const createRunResponseSchema = z.object({
  runId: z.string().min(1),
  config: runConfigSchema
});

export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;

export const postTurnRequestSchema = z.object({
  input: z.string(),
  forceReject: z.boolean().optional()
});

export type PostTurnRequest = z.infer<typeof postTurnRequestSchema>;

export const sseTurnEventSchema = z.object({
  event: z.literal("turn"),
  envelope: turnEnvelopeSchema
});

export const ssePhaseEventSchema = z.object({
  event: z.literal("phase"),
  transition: phaseTransitionWireSchema
});

export const cognitionTraceWireSchema = z.object({
  runId: z.string().min(1),
  turnId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  nodeId: z.string().min(1),
  label: z.string().min(1),
  ts: z.string().min(1),
  payload: z.record(z.unknown())
});

export type CognitionTraceWire = z.infer<typeof cognitionTraceWireSchema>;

export const sseTraceEventSchema = z.object({
  event: z.literal("trace"),
  trace: cognitionTraceWireSchema
});

export const sseWireEventSchema = z.discriminatedUnion("event", [
  sseTurnEventSchema,
  ssePhaseEventSchema,
  sseTraceEventSchema
]);

export type SseWireEvent = z.infer<typeof sseWireEventSchema>;
