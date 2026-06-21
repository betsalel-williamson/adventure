import { z } from "zod";

/** Aligns with `@adventure-nl/nl-glue` `PlannerUserPromptInput` structured form. */
export const inferenceModeSchema = z.enum(["planner", "interpret", "navigator"]);
export type InferenceMode = z.infer<typeof inferenceModeSchema>;

export const inferenceSchemaModeSchema = z.enum(["planner", "interpret"]).nullable();
export type InferenceSchemaMode = z.infer<typeof inferenceSchemaModeSchema>;

export const inferenceProviderIdSchema = z.enum(["google", "http", "ollama", "mlx"]);
export type InferenceProviderId = z.infer<typeof inferenceProviderIdSchema>;

export const inferenceModelHintSchema = z.object({
  providerId: inferenceProviderIdSchema,
  modelId: z.string().min(1).optional(),
});

export type InferenceModelHint = z.infer<typeof inferenceModelHintSchema>;

export const inferenceRequestSchema = z.object({
  requestId: z.string().uuid(),
  mode: inferenceModeSchema,
  system: z.string(),
  user: z.string(),
  schemaMode: inferenceSchemaModeSchema,
  modelHint: inferenceModelHintSchema.optional(),
});

export type InferenceRequest = z.infer<typeof inferenceRequestSchema>;

export const inferenceSuccessResponseSchema = z.object({
  requestId: z.string().uuid(),
  ok: z.literal(true),
  json: z.record(z.unknown()),
  text: z.string().optional(),
  providerId: inferenceProviderIdSchema,
  modelId: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
});

export const inferenceErrorResponseSchema = z.object({
  requestId: z.string().uuid(),
  ok: z.literal(false),
  code: z.string().min(1),
  message: z.string().min(1),
});

export const inferenceResponseSchema = z.discriminatedUnion("ok", [
  inferenceSuccessResponseSchema,
  inferenceErrorResponseSchema,
]);

export type InferenceResponse = z.infer<typeof inferenceResponseSchema>;

export const inferenceCapabilitySchema = z.object({
  providerId: inferenceProviderIdSchema,
  modelId: z.string().min(1),
  source: z.enum(["hosted", "server-local", "paired-desktop"]),
  label: z.string().min(1),
});

export type InferenceCapability = z.infer<typeof inferenceCapabilitySchema>;

export const inferenceCapabilitiesResponseSchema = z.object({
  capabilities: z.array(inferenceCapabilitySchema),
});

export type InferenceCapabilitiesResponse = z.infer<typeof inferenceCapabilitiesResponseSchema>;
