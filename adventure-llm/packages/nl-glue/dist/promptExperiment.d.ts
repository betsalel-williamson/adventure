import type { PlannerUserPromptInput } from "./textLlmContract.js";
export type PromptExperimentSystemMode = "default" | "replace" | "append";
export type PromptExperimentModelNotesTarget = "system" | "user_top";
/**
 * Dashboard / API state for tweaking planner strings before each autoplay model call.
 * Empty optional fields mean “no change” relative to the baseline from session memory.
 */
export type PromptExperimentPatch = {
    readonly systemMode?: PromptExperimentSystemMode;
    readonly systemText?: string;
    readonly userPrefix?: string;
    readonly userSuffix?: string;
    readonly modelNotes?: string;
    readonly modelNotesTarget?: PromptExperimentModelNotesTarget;
    /** When false, RTEXT HELP from adventure.dat is not prepended to planner system. Default true. */
    readonly includeDatHelpInSystem?: boolean;
};
export declare const defaultPromptExperimentPatch: () => PromptExperimentPatch;
/**
 * Applies experiment patch on top of the session-memory-built planner input.
 */
export declare function applyPlannerPromptExperiment(baseline: PlannerUserPromptInput, patch: PromptExperimentPatch): PlannerUserPromptInput;
/**
 * Shallow-merge JSON body into an existing patch (dashboard PATCH /api/prompt-experiment).
 */
export declare function patchPromptExperimentPatch(current: PromptExperimentPatch, body: unknown): PromptExperimentPatch;
//# sourceMappingURL=promptExperiment.d.ts.map