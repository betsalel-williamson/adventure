import { interpretedToGetinLine, swapInterpretedTokens, } from "./schema.js";
function toInterpreted(r) {
    return {
        primaryToken: r.primaryToken,
        secondaryToken: r.secondaryToken,
        confidence: r.confidence,
    };
}
function scriptedGetinLineFromTokenShape(cmd) {
    const firstLine = interpretedToGetinLine(cmd);
    const swapped = swapInterpretedTokens(cmd);
    const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
    if (retryLine !== undefined && retryLine.trimEnd() !== firstLine.trimEnd()) {
        return { line: firstLine, retryIfRejected: retryLine };
    }
    return firstLine;
}
/**
 * Turn interpret JSON into one or two GETIN lines (retry when the parser rejects the first).
 */
export function scriptedGetinLineFromInterpreted(interpreted) {
    return scriptedGetinLineFromTokenShape(interpreted);
}
/** Turn planner JSON into one or two GETIN lines (retry when the parser rejects the first). */
export function plannerToScriptedGetin(r) {
    return scriptedGetinLineFromTokenShape(toInterpreted(r));
}
//# sourceMappingURL=plannerToScriptedGetin.js.map