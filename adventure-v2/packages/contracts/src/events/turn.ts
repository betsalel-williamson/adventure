import { z } from "zod";

export const turnKindSchema = z.enum([
  "perceive",
  "proposal",
  "oracle_observation",
  "reconcile",
  "checkpoint",
  "recovery"
]);

export type TurnKind = z.infer<typeof turnKindSchema>;

export const sourceSchema = z.enum(["client", "cognition", "oracle", "control"]);
export type TurnSource = z.infer<typeof sourceSchema>;

export const turnEnvelopeSchema = z.object({
  runId: z.string().min(1),
  turnId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  source: sourceSchema,
  kind: turnKindSchema,
  ts: z.string().min(1),
  payload: z.record(z.string(), z.unknown())
});

export type TurnEnvelope = z.infer<typeof turnEnvelopeSchema>;

