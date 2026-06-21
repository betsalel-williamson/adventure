import { z } from "zod";

export const ag2AgentRoleSchema = z.enum([
  "cartographer",
  "navigator",
  "reviewer",
]);

export type Ag2AgentRole = z.infer<typeof ag2AgentRoleSchema>;

export type Ag2HandoffRequest = {
  readonly role: Ag2AgentRole;
  readonly transcript: string;
  /** Serializable map snapshot for model context. */
  readonly mapJson: unknown;
  /** Prior agent summary when handing off downstream. */
  readonly priorAgentSummary?: string;
};

export type Ag2HandoffResult = {
  readonly summary: string;
  /** Next agent to hand off to, or null when the turn is complete. */
  readonly handoffTo: Ag2AgentRole | null;
  /** Navigator-only: proposed compass move (uppercase) or null to stop. */
  readonly nextMoveUpper?: string | null;
};

/**
 * LLM/SLM backend for AG2-style multi-agent handoff.
 * Real AG2 (Python) adapters should satisfy this contract from a subprocess bridge.
 */
export type Ag2LlmAdapter = {
  readonly completeHandoffTurn: (
    req: Ag2HandoffRequest,
  ) => Promise<Ag2HandoffResult>;
};
