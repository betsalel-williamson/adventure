import type { AdventureDatabase } from "../dat/types.js";
import type { AutoplayPlannerResponse } from "./schema.js";
import { GoogleGenerativeAiTextLlm } from "./providers/googleGenerativeAiTextLlm.js";

export type GeminiAutoplayPlannerOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()`. */
  model?: string;
  /** Assembled user prompt (memory + vocabulary + transcript). */
  plannerUserPrompt: string;
  /** For {@link repairInterpretedCommand}. */
  recentGameTextForRepair?: string;
};

/**
 * @deprecated Prefer {@link planAutoplayWithTextLlm} with {@link resolveTextLlmFromEnv} or {@link GoogleGenerativeAiTextLlm}.
 * Single Google Generative AI call for self-acting mode: next parser tokens plus optional stop.
 */
export async function chooseNextMoveWithGemini(
  db: AdventureDatabase,
  options: GeminiAutoplayPlannerOptions,
): Promise<AutoplayPlannerResponse> {
  const client = new GoogleGenerativeAiTextLlm({
    apiKey: options.apiKey,
    model: options.model,
  });
  return client.planAutoplay(db, {
    plannerUserPrompt: options.plannerUserPrompt,
    recentGameTextForRepair: options.recentGameTextForRepair,
  });
}
