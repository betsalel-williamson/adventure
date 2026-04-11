import type { InterpretedCommand } from "./schema.js";
/**
 * When the player asks for instructions, help, or hints in natural language, map to the
 * parser token HELP. Otherwise Gemini may choose LOOK/EXAMI (verb 57), which repeats the
 * room and triggers SPEAK(15) ("NOT ALLOWED TO GIVE MORE DETAIL...") instead of hints.
 */
export declare function instructionIntentToHelpCommand(userText: string): InterpretedCommand | null;
//# sourceMappingURL=intent.d.ts.map