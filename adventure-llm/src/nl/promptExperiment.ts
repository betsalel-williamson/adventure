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

export const defaultPromptExperimentPatch = (): PromptExperimentPatch => ({
  systemMode: "default",
  systemText: "",
  userPrefix: "",
  userSuffix: "",
  modelNotes: "",
  modelNotesTarget: "system",
  includeDatHelpInSystem: true,
});

function trimOpt(s: string | undefined): string {
  return typeof s === "string" ? s.trim() : "";
}

/**
 * Applies experiment patch on top of the session-memory-built planner input.
 */
export function applyPlannerPromptExperiment(
  baseline: PlannerUserPromptInput,
  patch: PromptExperimentPatch,
): PlannerUserPromptInput {
  const systemMode = patch.systemMode ?? "default";
  const systemText = trimOpt(patch.systemText);
  const userPrefix = trimOpt(patch.userPrefix);
  const userSuffix = trimOpt(patch.userSuffix);
  const modelNotes = trimOpt(patch.modelNotes);
  const modelTarget = patch.modelNotesTarget ?? "system";

  if (typeof baseline === "string") {
    let s = baseline;
    if (systemMode === "replace" && systemText) {
      s = systemText;
      if (modelNotes) {
        s = s === "" ? modelNotes : `${modelNotes}\n\n${s}`;
      }
    } else {
      if (systemMode === "append" && systemText) {
        s = `${systemText}\n\n${s}`;
      }
      if (modelNotes) {
        s = s === "" ? modelNotes : `${modelNotes}\n\n${s}`;
      }
    }
    if (userPrefix) s = `${userPrefix}\n${s}`;
    if (userSuffix) s = `${s}\n${userSuffix}`;
    return s;
  }

  let system = baseline.system;
  let user = baseline.user;

  if (systemMode === "replace" && systemText) {
    system = systemText;
  } else if (systemMode === "append" && systemText) {
    system =
      system.trim() === "" ? systemText : `${system.trim()}\n\n${systemText}`;
  }

  if (modelNotes) {
    if (modelTarget === "user_top") {
      user = user.trim() === "" ? modelNotes : `${modelNotes}\n\n${user}`;
    } else {
      system =
        system.trim() === "" ? modelNotes : `${system.trim()}\n\n${modelNotes}`;
    }
  }

  if (userPrefix) user = `${userPrefix}\n${user}`;
  if (userSuffix) user = `${user}\n${userSuffix}`;

  return { system: system.trim(), user: user.trim() };
}

function isSystemMode(v: unknown): v is PromptExperimentSystemMode {
  return v === "default" || v === "replace" || v === "append";
}

function isNotesTarget(v: unknown): v is PromptExperimentModelNotesTarget {
  return v === "system" || v === "user_top";
}

/**
 * Shallow-merge JSON body into an existing patch (dashboard PATCH /api/prompt-experiment).
 */
export function patchPromptExperimentPatch(
  current: PromptExperimentPatch,
  body: unknown,
): PromptExperimentPatch {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return current;
  }
  const b = body as Record<string, unknown>;
  return {
    systemMode: isSystemMode(b.systemMode) ? b.systemMode : current.systemMode,
    systemText:
      typeof b.systemText === "string" ? b.systemText : current.systemText,
    userPrefix:
      typeof b.userPrefix === "string" ? b.userPrefix : current.userPrefix,
    userSuffix:
      typeof b.userSuffix === "string" ? b.userSuffix : current.userSuffix,
    modelNotes:
      typeof b.modelNotes === "string" ? b.modelNotes : current.modelNotes,
    modelNotesTarget: isNotesTarget(b.modelNotesTarget)
      ? b.modelNotesTarget
      : current.modelNotesTarget,
    includeDatHelpInSystem:
      typeof b.includeDatHelpInSystem === "boolean"
        ? b.includeDatHelpInSystem
        : current.includeDatHelpInSystem,
  };
}
