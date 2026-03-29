import type { AdventureDatabase } from "../dat/types.js";
import {
  coerceAutoplayPlannerToVocab,
  coerceInterpretedCommandToVocab,
} from "./coerceToVocab.js";
import { travelMotionPrimaryIgnoresSecondColumn } from "./inferredExplorationMap.js";
import { repairInterpretedCommand } from "./repairInterpreted.js";
import type { AutoplayPlannerResponse, InterpretedCommand } from "./schema.js";

/** Motion/travel primaries do not use GETIN column 2; strip hallucinated object secondaries. */
function stripSpuriousAutoplayTravelSecondary(
  cmd: InterpretedCommand,
): InterpretedCommand {
  const p = cmd.primaryToken.toUpperCase().slice(0, 5).trimEnd();
  const s = cmd.secondaryToken?.trim();
  if (!s || s.length === 0) return cmd;
  if (!travelMotionPrimaryIgnoresSecondColumn(p)) return cmd;
  return { ...cmd, secondaryToken: undefined };
}

/**
 * Shared post-parse path for interpret: snap tokens to ATAB (+ QUIT), then repair heuristics.
 */
export function finalizeInterpretedCommand(
  db: AdventureDatabase,
  userText: string,
  rawCmd: InterpretedCommand,
  recentGameText?: string,
): InterpretedCommand {
  const vocabCmd = coerceInterpretedCommandToVocab(db, rawCmd);
  return repairInterpretedCommand(userText, vocabCmd, recentGameText);
}

/**
 * Shared post-parse path for autoplay planner JSON.
 */
export function finalizeAutoplayPlannerResponse(
  db: AdventureDatabase,
  raw: AutoplayPlannerResponse,
  recentGameTextForRepair?: string,
): AutoplayPlannerResponse {
  const coerced = coerceAutoplayPlannerToVocab(db, raw);
  const continuePlaying = coerced.continuePlaying ?? true;
  const repaired = repairInterpretedCommand(
    "autoplay",
    {
      primaryToken: coerced.primaryToken,
      secondaryToken: coerced.secondaryToken,
      confidence: coerced.confidence,
    },
    recentGameTextForRepair,
  );
  const cleaned = stripSpuriousAutoplayTravelSecondary(repaired);
  return { ...cleaned, continuePlaying };
}
