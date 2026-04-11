import type { AdventureDatabase } from "../dat/types.js";
import {
  resolveAutoplayPromptMode,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
  resolveVocabHintMaxWords,
  type AutoplayPromptMode,
} from "./adventureNlPrompts.js";
import {
  applyPlannerPromptExperiment,
  type PromptExperimentPatch,
} from "./promptExperiment.js";
import {
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
  recentTextSuggestsIndoorBuildingNavigation,
  shouldPrioritizeLootFunnel,
} from "./situationalCandidates.js";
import { buildVocabHint } from "./vocabHint.js";
import type { AutoplaySessionMemory } from "./autoplaySessionMemory.js";
import type {
  PlannerUserPromptInput,
  TextLlmProviderId,
} from "./textLlmContract.js";

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
export function buildAutoplayPlannerInvocation(
  input: BuildAutoplayPlannerInvocationInput,
): AutoplayPlannerInvocation {
  const {
    db,
    memory,
    contextChars,
    providerId,
    recentForRepairRaw,
    overrides,
  } = input;
  const compact = resolveCompactPrompts(providerId);
  const structuredDashboard = resolveStructuredDashboardPrompts(providerId);
  const repairTailChars = compact ? 1200 : 2500;
  const stagnating = memory.isLocationStagnating();
  const tryNextLine = memory.formatExplorationTryNextLine();
  const vocabHint = buildVocabHint(db, resolveVocabHintMaxWords(compact), {
    grouped: !compact,
    structuredGroups: structuredDashboard && !compact,
    compact,
  });
  const objectScope = memory.getObjectHintScopeText();
  const indoorLeave = recentTextSuggestsIndoorBuildingNavigation(objectScope);
  const promptMode =
    overrides?.getAutoplayPromptMode?.() ?? resolveAutoplayPromptMode();
  const invLines = memory.getStructuredInventory();
  const takeFailWords = memory.getRoomTakeFailureObjectAtabWords();
  const lootFunnel = shouldPrioritizeLootFunnel(
    db,
    objectScope,
    invLines,
    takeFailWords,
  );
  const situationalSection = formatSituationalCandidatesSection(
    db,
    buildSituationalCandidateTokens(db, memory.getRecentRawTail(), {
      deprioritize: stagnating ? ["ROAD"] : [],
      indoorLeaveBuilding: indoorLeave,
      exploreFirst: promptMode === "explore",
      inventorySubtractText:
        invLines.length > 0 ? invLines.join("\n") : undefined,
      takeFailureSubtractWords: takeFailWords,
      objectHintScopeText: objectScope,
      lootFunnel,
    }),
    stagnating && tryNextLine.length > 0 ? tryNextLine : undefined,
    {
      flatList: !compact,
      slmGrouped: compact,
      lootFunnelDeferCandMove: lootFunnel,
    },
  );
  const useMxStructuredSplit = providerId === "mlx" && structuredDashboard;
  const baselinePlannerPrompt: PlannerUserPromptInput = useMxStructuredSplit
    ? memory.buildPlannerMxStructuredPrompt(contextChars, {
        compact,
        situationalSection,
        lootFunnel,
      })
    : memory.buildPlannerUserPrompt(contextChars, vocabHint, {
        compact,
        situationalSection,
        structuredDashboard,
      });
  const experimentPatch = overrides?.getPlannerPromptExperiment?.() ?? {};
  const plannerUserPrompt = applyPlannerPromptExperiment(
    baselinePlannerPrompt,
    experimentPatch,
  );
  const includeDatHelp = experimentPatch.includeDatHelpInSystem !== false;
  return {
    plannerUserPrompt,
    recentGameTextForRepair: recentForRepairRaw.slice(-repairTailChars),
    includeDatHelpInSystem: includeDatHelp,
    useMxStructuredSplit,
    compact,
    structuredDashboard,
  };
}
