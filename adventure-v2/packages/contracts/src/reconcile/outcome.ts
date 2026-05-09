import { z } from "zod";

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
  nextPolicy: nextPolicySchema
});

export type ReconcileOutcome = z.infer<typeof reconcileOutcomeSchema>;

