import {
  interpretedToGetinLine,
  swapInterpretedTokens,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "./schema.js";
import type { ScriptedGetinLine } from "./scriptedGetinLine.js";

type InterpretedTokenShape = {
  readonly primaryToken: string;
  readonly secondaryToken?: string;
  readonly confidence?: number;
};

function toInterpreted(r: AutoplayPlannerResponse): InterpretedTokenShape {
  return {
    primaryToken: r.primaryToken,
    secondaryToken: r.secondaryToken,
    confidence: r.confidence,
  };
}

function scriptedGetinLineFromTokenShape(
  cmd: InterpretedTokenShape,
): ScriptedGetinLine {
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
export function scriptedGetinLineFromInterpreted(
  interpreted: InterpretedCommand,
): ScriptedGetinLine {
  return scriptedGetinLineFromTokenShape(interpreted);
}

/** Turn planner JSON into one or two GETIN lines (retry when the parser rejects the first). */
export function plannerToScriptedGetin(
  r: AutoplayPlannerResponse,
): ScriptedGetinLine {
  return scriptedGetinLineFromTokenShape(toInterpreted(r));
}
