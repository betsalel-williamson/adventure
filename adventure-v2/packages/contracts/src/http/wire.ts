import { z } from "zod";
import { runConfigSchema } from "../api/run.js";
import { turnEnvelopeSchema } from "../events/turn.js";

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

export const sseWireEventSchema = z.discriminatedUnion("event", [
  sseTurnEventSchema,
  ssePhaseEventSchema
]);

export type SseWireEvent = z.infer<typeof sseWireEventSchema>;
