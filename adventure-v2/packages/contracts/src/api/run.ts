import { z } from "zod";

export const modelCategorySchema = z.enum(["SLM", "LLM", "API", "MLX"]);
export type ModelCategory = z.infer<typeof modelCategorySchema>;

export const runConfigSchema = z.object({
  scenarioId: z.string().min(1),
  modelCategory: modelCategorySchema,
  modelName: z.string().min(1),
  seed: z.number().int().nonnegative(),
  /**
   * Optional agent/cognition preset label for benchmarks and future server routing.
   * Current server always runs the bundled LangGraph brain unless extended explicitly.
   */
  cognitionProfile: z.string().min(1).max(128).optional()
});

export type RunConfig = z.infer<typeof runConfigSchema>;

