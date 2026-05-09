/**
 * Stub prompt catalog for deterministic CI and observability on the cognition trace wire.
 * Real LLM routing remains out of scope for this slice (see README ModelAdapter follow-on).
 */
export const SYSTEM_ADVENTURE_AGENT =
  "You are the Adventure v2 agent. Map natural language to concise GETIN-style adventure commands.";

export const buildPlanPromptBundle = (userTurn: string): { system: string; user: string } => ({
  system: SYSTEM_ADVENTURE_AGENT,
  user: `Turn input:\n${userTurn}`
});
