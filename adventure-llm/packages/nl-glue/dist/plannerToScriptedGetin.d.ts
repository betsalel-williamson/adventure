import { type AutoplayPlannerResponse, type InterpretedCommand } from "./schema.js";
import type { ScriptedGetinLine } from "./scriptedGetinLine.js";
/**
 * Turn interpret JSON into one or two GETIN lines (retry when the parser rejects the first).
 */
export declare function scriptedGetinLineFromInterpreted(interpreted: InterpretedCommand): ScriptedGetinLine;
/** Turn planner JSON into one or two GETIN lines (retry when the parser rejects the first). */
export declare function plannerToScriptedGetin(r: AutoplayPlannerResponse): ScriptedGetinLine;
//# sourceMappingURL=plannerToScriptedGetin.d.ts.map