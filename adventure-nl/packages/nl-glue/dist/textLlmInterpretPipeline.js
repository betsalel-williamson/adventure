import { coerceAutoplayPlannerToVocab, coerceInterpretedCommandToVocab, } from "./coerceToVocab.js";
import { travelMotionPrimaryIgnoresSecondColumn } from "./inferredExplorationMap.js";
import { repairInterpretedCommand } from "./repairInterpreted.js";
/** Motion/travel primaries do not use GETIN column 2; strip hallucinated object secondaries. */
function stripSpuriousAutoplayTravelSecondary(cmd) {
    const p = cmd.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    const s = cmd.secondaryToken?.trim();
    if (!s || s.length === 0)
        return cmd;
    if (!travelMotionPrimaryIgnoresSecondColumn(p))
        return cmd;
    return { ...cmd, secondaryToken: undefined };
}
/**
 * Shared post-parse path for interpret: snap tokens to ATAB (+ QUIT), then repair heuristics.
 */
export function finalizeInterpretedCommand(db, userText, rawCmd, recentGameText) {
    const vocabCmd = coerceInterpretedCommandToVocab(db, rawCmd);
    return repairInterpretedCommand(userText, vocabCmd, recentGameText);
}
/**
 * Shared post-parse path for autoplay planner JSON.
 */
export function finalizeAutoplayPlannerResponse(db, raw, recentGameTextForRepair) {
    const coerced = coerceAutoplayPlannerToVocab(db, raw);
    const continuePlaying = coerced.continuePlaying ?? true;
    const repaired = repairInterpretedCommand("autoplay", {
        primaryToken: coerced.primaryToken,
        secondaryToken: coerced.secondaryToken,
        confidence: coerced.confidence,
    }, recentGameTextForRepair);
    const cleaned = stripSpuriousAutoplayTravelSecondary(repaired);
    return { ...cleaned, continuePlaying };
}
//# sourceMappingURL=textLlmInterpretPipeline.js.map