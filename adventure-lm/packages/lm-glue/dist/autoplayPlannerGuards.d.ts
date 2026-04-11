import type { AutoplaySessionMemory } from "./autoplaySessionMemory.js";
import { type AutoplayPlannerResponse } from "./schema.js";
/**
 * Planner output guards shared by Node autoplay and browser-orchestrated autoplay (ADR0005).
 */
export declare function planAfterAutoplayGuards(memory: AutoplaySessionMemory, plan: AutoplayPlannerResponse, log: (line: string) => void): AutoplayPlannerResponse;
//# sourceMappingURL=autoplayPlannerGuards.d.ts.map