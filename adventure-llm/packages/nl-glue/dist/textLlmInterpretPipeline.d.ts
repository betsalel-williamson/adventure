import type { AdventureDatabase } from "./dat/types.js";
import type { AutoplayPlannerResponse, InterpretedCommand } from "./schema.js";
/**
 * Shared post-parse path for interpret: snap tokens to ATAB (+ QUIT), then repair heuristics.
 */
export declare function finalizeInterpretedCommand(db: AdventureDatabase, userText: string, rawCmd: InterpretedCommand, recentGameText?: string): InterpretedCommand;
/**
 * Shared post-parse path for autoplay planner JSON.
 */
export declare function finalizeAutoplayPlannerResponse(db: AdventureDatabase, raw: AutoplayPlannerResponse, recentGameTextForRepair?: string): AutoplayPlannerResponse;
//# sourceMappingURL=textLlmInterpretPipeline.d.ts.map