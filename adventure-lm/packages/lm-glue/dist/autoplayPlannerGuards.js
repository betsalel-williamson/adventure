import { interpretedToGetinLine, } from "./schema.js";
function toInterpreted(r) {
    return {
        primaryToken: r.primaryToken,
        secondaryToken: r.secondaryToken,
        confidence: r.confidence,
    };
}
/**
 * Planner output guards shared by Node autoplay and browser-orchestrated autoplay (ADR0005).
 */
export function planAfterAutoplayGuards(memory, plan, log) {
    let planSafe = memory.avoidRepeatingRejectedCommand(plan);
    if (interpretedToGetinLine(toInterpreted(plan)) !==
        interpretedToGetinLine(toInterpreted(planSafe))) {
        log("adventure-lm: autoplay — replaced plan that repeated a parser-rejected GETIN line\n");
    }
    const beforeTakeCarry = planSafe;
    planSafe = memory.avoidRedundantTakeWhenCarrying(planSafe);
    if (interpretedToGetinLine(toInterpreted(beforeTakeCarry)) !==
        interpretedToGetinLine(toInterpreted(planSafe))) {
        log("adventure-lm: autoplay — replaced plan: TAKE/GET object already in inventory\n");
    }
    const beforeOsc = planSafe;
    planSafe = memory.avoidOscillatingCommand(planSafe);
    if (interpretedToGetinLine(toInterpreted(beforeOsc)) !==
        interpretedToGetinLine(toInterpreted(planSafe))) {
        log("adventure-lm: autoplay — replaced plan that would continue a two-location loop\n");
    }
    const beforeStag = planSafe;
    planSafe = memory.avoidStagnatingCommand(planSafe);
    if (interpretedToGetinLine(toInterpreted(beforeStag)) !==
        interpretedToGetinLine(toInterpreted(planSafe))) {
        log("adventure-lm: autoplay — replaced plan due to location stagnation (inferred map)\n");
    }
    const beforeLook = planSafe;
    planSafe = memory.avoidRepeatedLookExamiInSameCell(planSafe);
    if (interpretedToGetinLine(toInterpreted(beforeLook)) !==
        interpretedToGetinLine(toInterpreted(planSafe))) {
        log("adventure-lm: autoplay — replaced plan: LOOK/EXAMI already used without leaving this room (inferred map)\n");
    }
    return planSafe;
}
//# sourceMappingURL=autoplayPlannerGuards.js.map