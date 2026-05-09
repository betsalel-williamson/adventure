import { z } from "zod";

export const modelCategorySchema = z.enum(["SLM", "LLM", "API", "MLX"]);
export type ModelCategory = z.infer<typeof modelCategorySchema>;

export const runConfigSchema = z.object({
  scenarioId: z.string().min(1),
  modelCategory: modelCategorySchema,
  modelName: z.string().min(1),
  seed: z.number().int().nonnegative()
});

export type RunConfig = z.infer<typeof runConfigSchema>;

