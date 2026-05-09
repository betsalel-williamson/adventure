/**
 * Deterministic stub planner for dev-shell autoplay (no LLM). Cycles fixed commands
 * so CI and local runs stay hermetic.
 */

export type StubAutoplayContext = {
  moveIndex: number;
  /** Reserved for future heuristics (e.g. parse oracle tail). */
  lastOracleOutput?: string;
};

const DEFAULT_CYCLE = ["look", "north", "south", "east", "west", "inventory"] as const;

export const stubPlanNextMove = (
  ctx: StubAutoplayContext,
  cycle: readonly string[] = DEFAULT_CYCLE
): string => cycle[ctx.moveIndex % cycle.length]!;
