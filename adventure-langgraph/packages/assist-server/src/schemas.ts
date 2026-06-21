import { z } from "zod";

export const assistStepBodySchema = z.object({
  runId: z.string(),
  transcript: z.string(),
  assistancePosture: z.enum(["quickAssist", "studyFirst"]).optional(),
  studyFirstConfirmed: z.boolean().optional(),
  /** When false, merge transcript into graph only (no LangGraph navigator / SLM move). */
  advance: z.boolean().optional(),
});

export type AssistStepBody = z.infer<typeof assistStepBodySchema>;

export const assistIngestBodySchema = z.object({
  runId: z.string(),
  transcript: z.string(),
  line: z.string().optional(),
  context: z
    .object({
      priorLines: z.array(z.string()).optional(),
      currentPlaceId: z.string().nullable().optional(),
    })
    .optional(),
  patch: z.unknown().optional(),
});

export type AssistIngestBody = z.infer<typeof assistIngestBodySchema>;

export const assistErrorResponseSchema = z.object({
  status: z.literal("error"),
  errorMessage: z.string(),
});

export const assistHealthResponseSchema = z.object({
  status: z.literal("ok"),
  adapter: z.string(),
  probeEnabled: z.boolean(),
});

export const assistIngestResponseSchema = z.object({
  status: z.literal("ok"),
  mapJson: z.unknown(),
  mermaid: z.string(),
});

export const assistStepOkResponseSchema = z.object({
  status: z.literal("ok"),
  nextMove: z.string().nullable(),
  mapJson: z.unknown().nullable(),
  mermaid: z.string(),
  notice: z.string().optional(),
});

export const assistStepResponseSchema = z.union([
  assistStepOkResponseSchema,
  assistErrorResponseSchema,
]);

export const assistIngestResponseUnionSchema = z.union([
  assistIngestResponseSchema,
  assistErrorResponseSchema,
]);
