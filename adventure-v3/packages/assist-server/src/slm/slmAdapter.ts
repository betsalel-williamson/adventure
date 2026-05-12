import { z } from "zod";

export const navigatorMoveSchema = z.object({
  move: z
    .enum(["N", "E", "S", "W", "U", "D", "n", "e", "s", "w", "u", "d"])
    .nullable(),
});

export type NavigatorMoveJson = z.infer<typeof navigatorMoveSchema>;

export type NavigatorHintRequest = {
  readonly transcript: string;
  /** Serializable map for optional model context. */
  readonly mapJson: unknown;
};

export type NavigatorHintResult = {
  /** Uppercase single letter for `postTurn`, or null to stop. */
  readonly nextMoveUpper: string | null;
};

/**
 * SLM backend contract (Llama / Gemma via Ollama, MLX HTTP, etc.).
 * Implementations must return schema-valid moves or throw.
 */
export type SlmAdapter = {
  readonly completeNavigatorMove: (
    req: NavigatorHintRequest,
  ) => Promise<NavigatorHintResult>;
};
