import { z } from "zod";

/** Gemini / NL layer output before GETIN normalization. */
export const InterpretedCommandSchema = z.object({
  primaryToken: z.string().max(5).describe("First five-letter verb or motion word"),
  secondaryToken: z.string().max(5).optional().describe("Optional object or second word"),
  confidence: z.number().min(0).max(1).optional(),
});

export type InterpretedCommand = z.infer<typeof InterpretedCommandSchema>;

/** Build a single GETIN line from interpreted tokens (two words in first ten columns). */
export function interpretedToGetinLine(cmd: InterpretedCommand): string {
  const a = cmd.primaryToken.toUpperCase().slice(0, 5).padEnd(5, " ");
  const b = (cmd.secondaryToken ?? "").toUpperCase().slice(0, 5).padEnd(5, " ");
  return `${a}${b}`;
}
