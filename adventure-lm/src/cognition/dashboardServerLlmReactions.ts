/**
 * Server-side reactions to language-model output (interpret JSON → GETIN, planner JSON).
 *
 * Phase A (ADR0014): keep these out of the HTTP transport layer (`webDashboard.ts`) so the
 * dashboard can stay a thin coordinator; long term, browser-orchestrated paths move this work
 * client-side (ADR0005).
 */
import type { AdventureDatabase } from "../dat/types.js";
import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";
import {
  interpretWithTextLlm,
  planAutoplayWithTextLlm,
} from "../nl/adventureTextLlm.js";
import {
  scriptedGetinLineFromInterpreted,
  type AutoplayPlannerResponse,
  type PlannerUserPromptInput,
  type TextLlm,
} from "@adventure-lm/lm-glue";

export async function interpretNaturalLanguageToScriptedGetin(
  natural: string,
  db: AdventureDatabase,
  client: TextLlm,
  options: { recentGameText: string },
): Promise<ScriptedGetinLine> {
  const interpreted = await interpretWithTextLlm(natural, db, client, options);
  return scriptedGetinLineFromInterpreted(interpreted);
}

export async function runServerAutoplayPlanner(
  db: AdventureDatabase,
  client: TextLlm,
  options: {
    plannerUserPrompt: PlannerUserPromptInput;
    recentGameTextForRepair: string;
    includeDatHelpInSystem: boolean;
  },
): Promise<AutoplayPlannerResponse> {
  return planAutoplayWithTextLlm(db, client, {
    plannerUserPrompt: options.plannerUserPrompt,
    recentGameTextForRepair: options.recentGameTextForRepair,
    includeDatHelpInSystem: options.includeDatHelpInSystem,
  });
}
