import { z } from "zod";

/** How the oracle subprocess or harness classified this observation (R3 visibility). */
export const oracleObservationOutcomeSchema = z.enum(["accepted", "rejected", "transport_error"]);

export type OracleObservationOutcome = z.infer<typeof oracleObservationOutcomeSchema>;

/** Payload for `TurnEnvelope` with `kind: "oracle_observation"`. */
export const oracleObservationPayloadSchema = z.object({
  rejected: z.boolean(),
  output: z.string(),
  outcome: oracleObservationOutcomeSchema.optional(),
  stderrExcerpt: z.string().max(120).optional()
});

export type OracleObservationPayload = z.infer<typeof oracleObservationPayloadSchema>;
