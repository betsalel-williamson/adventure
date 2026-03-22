import { z } from "zod";

/** Gemini / NL layer output before GETIN normalization. */
export const InterpretedCommandSchema = z.object({
  primaryToken: z
    .string()
    .max(5)
    .describe("First five-letter verb or motion word"),
  secondaryToken: z
    .string()
    .max(5)
    .optional()
    .describe("Optional object or second word"),
  confidence: z.number().min(0).max(1).optional(),
});

export type InterpretedCommand = z.infer<typeof InterpretedCommandSchema>;

/** Autoplay planner: same tokens plus optional stop signal. */
export const AutoplayPlannerResponseSchema = InterpretedCommandSchema.extend({
  /** When false, the session ends after this response (no further GETIN). */
  continuePlaying: z.boolean().optional(),
});

export type AutoplayPlannerResponse = z.infer<
  typeof AutoplayPlannerResponseSchema
>;

/** Build a single GETIN line from interpreted tokens (two words in first ten columns). */
export function interpretedToGetinLine(cmd: InterpretedCommand): string {
  const a = cmd.primaryToken.toUpperCase().slice(0, 5).padEnd(5, " ");
  const b = (cmd.secondaryToken ?? "").toUpperCase().slice(0, 5).padEnd(5, " ");
  return `${a}${b}`;
}

/**
 * Second GETIN attempt when the first line is rejected: swap verb and object slots.
 * Some NL maps put the object in `primaryToken` and the verb in `secondaryToken`.
 */
export function swapInterpretedTokens(
  cmd: InterpretedCommand,
): InterpretedCommand | null {
  const s = cmd.secondaryToken?.trim();
  if (!s) return null;
  return {
    primaryToken: s.toUpperCase().slice(0, 5),
    secondaryToken: cmd.primaryToken.toUpperCase().slice(0, 5),
    confidence: cmd.confidence,
  };
}
