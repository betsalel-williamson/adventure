import type { InterpretedCommand } from "./schema.js";
/**
 * Heuristic fixes for common Gemini mistakes (phrasal "pick up" → motion UP, object-only TAKE lines).
 * Uses recent game text to resolve "them"/"it" when the cave asked about a specific object.
 */
export declare function repairInterpretedCommand(userText: string, cmd: InterpretedCommand, recentGameText?: string): InterpretedCommand;
//# sourceMappingURL=repairInterpreted.d.ts.map