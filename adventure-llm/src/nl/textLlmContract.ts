import type { AdventureDatabase } from "../dat/types.js";
import type { AutoplayPlannerResponse, InterpretedCommand } from "./schema.js";

export type TextLlmProviderId = "google" | "http" | "mlx";

/**
 * Vendor-neutral text LLM used for NL → parser tokens and autoplay planning.
 */
export type TextLlm = {
  readonly providerId: TextLlmProviderId;
  readonly modelId: string;
  interpretPlayerInput(
    userText: string,
    db: AdventureDatabase,
    options: { recentGameText?: string },
  ): Promise<InterpretedCommand>;
  planAutoplay(
    db: AdventureDatabase,
    options: {
      plannerUserPrompt: string;
      recentGameTextForRepair?: string;
    },
  ): Promise<AutoplayPlannerResponse>;
};
