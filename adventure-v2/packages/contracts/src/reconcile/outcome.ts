import { z } from "zod";
import { oracleObservationOutcomeSchema } from "../events/oracleObservation.js";

export const driftClassSchema = z.enum([
  "none",
  "location",
  "inventory",
  "constraint",
  "parser",
  "unknown"
]);

export const nextPolicySchema = z.enum(["continue", "test", "chaos"]);

export const reconcileOutcomeSchema = z.object({
  runId: z.string().min(1),
  turnId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  driftDetected: z.boolean(),
  driftClass: driftClassSchema,
  beliefPatch: z.record(z.string(), z.unknown()),
  confidenceBefore: z.number().min(0).max(1),
  confidenceAfter: z.number().min(0).max(1),
  nextPolicy: nextPolicySchema,
  /** Stable id for this turn’s reconcile row (defaults to turnId when omitted by producers). */
  correlationId: z.string().min(1).max(128).optional(),
  /** Short human-readable rationale for drift or transport failure (bounded for SSE payloads). */
  driftSummary: z.string().max(512).optional(),
  evidence: z
    .object({
      oracleOutcome: oracleObservationOutcomeSchema.optional(),
      outputExcerpt: z.string().max(200).optional()
    })
    .optional()
});

export type ReconcileOutcome = z.infer<typeof reconcileOutcomeSchema>;

