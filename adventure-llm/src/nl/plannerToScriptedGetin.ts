import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";
import {
  interpretedToGetinLine,
  swapInterpretedTokens,
  type AutoplayPlannerResponse,
} from "./schema.js";

function toInterpreted(r: AutoplayPlannerResponse): {
  primaryToken: string;
  secondaryToken?: string;
  confidence?: number;
} {
  return {
    primaryToken: r.primaryToken,
    secondaryToken: r.secondaryToken,
    confidence: r.confidence,
  };
}

/** Turn planner JSON into one or two GETIN lines (retry when the parser rejects the first). */
export function plannerToScriptedGetin(
  r: AutoplayPlannerResponse,
): ScriptedGetinLine {
  const cmd = toInterpreted(r);
  const firstLine = interpretedToGetinLine(cmd);
  const swapped = swapInterpretedTokens(cmd);
  const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
  if (retryLine !== undefined && retryLine.trimEnd() !== firstLine.trimEnd()) {
    return { line: firstLine, retryIfRejected: retryLine };
  }
  return firstLine;
}
