/**
 * When the player asks for instructions, help, or hints in natural language, map to the
 * parser token HELP. Otherwise Gemini may choose LOOK/EXAMI (verb 57), which repeats the
 * room and triggers SPEAK(15) ("NOT ALLOWED TO GIVE MORE DETAIL...") instead of hints.
 */
export function instructionIntentToHelpCommand(userText) {
    const t = userText.trim().toLowerCase();
    if (t.length === 0)
        return null;
    if (/\binstructions?\b/.test(t) ||
        /\bhelp\b/.test(t) ||
        /\bhints?\b/.test(t) ||
        /\bhow\s+do\s+i\s+(play|start)\b/.test(t) ||
        /\bwhat\s+(can|should)\s+i\s+do\b/.test(t)) {
        return { primaryToken: "HELP", confidence: 1 };
    }
    return null;
}
//# sourceMappingURL=intent.js.map