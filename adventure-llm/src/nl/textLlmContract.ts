import type { AdventureDatabase } from "../dat/types.js";
import type { AutoplayPlannerResponse, InterpretedCommand } from "./schema.js";

export type TextLlmProviderId = "google" | "http" | "mlx";

/** Optional overrides for interpret prompt layout (defaults follow provider + env). */
export type InterpretPromptStyleOverrides = {
  readonly compact?: boolean;
  readonly structuredDashboard?: boolean;
};

export type InterpretPlayerInputOptions = {
  readonly recentGameText?: string;
  readonly promptStyle?: InterpretPromptStyleOverrides;
};

/**
 * Autoplay planner body: either one string (legacy) or Gemma-style instruction vs context
 * (merged into a single user turn for models without a system role — see MLX worker).
 */
export type PlannerUserPromptInput =
  | string
  | { readonly system: string; readonly user: string };

/**
 * Vendor-neutral text LLM used for NL → parser tokens and autoplay planning.
 */
export type TextLlm = {
  readonly providerId: TextLlmProviderId;
  readonly modelId: string;
  interpretPlayerInput(
    userText: string,
    db: AdventureDatabase,
    options: InterpretPlayerInputOptions,
  ): Promise<InterpretedCommand>;
  planAutoplay(
    db: AdventureDatabase,
    options: {
      plannerUserPrompt: PlannerUserPromptInput;
      recentGameTextForRepair?: string;
    },
  ): Promise<AutoplayPlannerResponse>;
  /**
   * Plain-text completion for offline maintenance (e.g. AI vocabulary categorization).
   * Not used for interpret/autoplay JSON flows.
   */
  generateUnstructured(prompt: string): Promise<string>;
};
