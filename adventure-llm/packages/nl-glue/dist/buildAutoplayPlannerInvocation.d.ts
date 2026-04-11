import type { AdventureDatabase } from "./dat/types.js";
import { type AutoplayPromptMode } from "./adventureNlPrompts.js";
import { type PromptExperimentPatch } from "./promptExperiment.js";
import type { AutoplaySessionMemory } from "./autoplaySessionMemory.js";
import type { PlannerUserPromptInput, TextLlmProviderId } from "./textLlmContract.js";
export type AutoplayRunOverridesRef = {
    readonly getPlannerPromptExperiment?: () => PromptExperimentPatch;
    readonly getAutoplayPromptMode?: () => AutoplayPromptMode;
};
export type BuildAutoplayPlannerInvocationInput = {
    readonly db: AdventureDatabase;
    readonly memory: AutoplaySessionMemory;
    readonly contextChars: number;
    readonly providerId: TextLlmProviderId;
    /** Full tail used for repair; sliced using the same repair window as {@link resolveAutoplayPromptLayout}. */
    readonly recentForRepairRaw: string;
    readonly overrides?: AutoplayRunOverridesRef;
};
export type AutoplayPlannerInvocation = {
    readonly plannerUserPrompt: PlannerUserPromptInput;
    readonly recentGameTextForRepair: string;
    readonly includeDatHelpInSystem: boolean;
    readonly useMxStructuredSplit: boolean;
    readonly compact: boolean;
    readonly structuredDashboard: boolean;
};
/**
 * Builds semantic planner prompts and repair tail — shared by server autoplay and browser cognition (ADR0005).
 */
export declare function buildAutoplayPlannerInvocation(input: BuildAutoplayPlannerInvocationInput): AutoplayPlannerInvocation;
//# sourceMappingURL=buildAutoplayPlannerInvocation.d.ts.map