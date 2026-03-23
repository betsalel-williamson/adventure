import type { AdventureDatabase } from "../dat/types.js";
import {
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "../text/speak.js";
import { buildVocabHint } from "./vocabHint.js";

// -----------------------------------------------------------------------------
// Single source of instruction text for all TextLlm providers (Google, HTTP, MLX).
// -----------------------------------------------------------------------------

/** NL interpret: opening role (maps free text → parser tokens). */
export const ADVENTURE_LLM_INTERPRET_ROLE =
  "You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).";

/**
 * Shared parser semantics for NL interpret and autoplay — keep in sync everywhere.
 * (primaryToken / secondaryToken / TAKE vs motion UP / TOUCH, etc.)
 */
export const ADVENTURE_LLM_PARSER_TOKEN_RULES = `Rules: (1) For taking or carrying something, use primaryToken TAKE or GET and put the object in secondaryToken — never put the object alone in primaryToken. (2) The word UP in column 1 alone means GO UP (a direction), NOT the phrasal verb in "pick it up" / "pick them up"; those mean TAKE + object. (3) For picking up items, prefer TAKE or GET over TOUCH (TOUCH often yields an unhelpful game response). (4) Do not use NULL or placeholder secondaries.`;

/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE =
  "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";

/** Footer for interpret prompts (appended after user line + rules). */
export function adventureLlmInterpretJsonFooter(): string {
  return "Output a single JSON object with keys: primaryToken (string, required), secondaryToken (string, optional), confidence (number 0-1, optional). No other text.";
}

/** Footer for autoplay full prompt (after help + planner user body from memory). */
export function adventureLlmAutoplayJsonFooter(): string {
  return "Reply with a single JSON object only: primaryToken (string, required), secondaryToken (optional), confidence (optional), continuePlaying (boolean, optional, default true). No markdown fences.";
}

/**
 * Opening section for autoplay planner **context** (vocabulary + shared rules).
 * Caller appends derived state, turn log, raw transcript, then the global prompt
 * builder adds HELP + this body + {@link adventureLlmAutoplayJsonFooter}.
 */
export function linesForAutoplayPlannerContextBody(
  vocabSectionText: string,
): string[] {
  return [
    ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE,
    "Use only vocabulary words from the list when possible.",
    ADVENTURE_LLM_PARSER_TOKEN_RULES,
    "",
    "## Vocabulary (words the game parser accepts)",
    vocabSectionText,
  ];
}

export function buildInterpretSystemAndUserPrompt(
  db: AdventureDatabase,
  userText: string,
  recentGameText: string | undefined,
): string {
  const hint = buildVocabHint(db, 120);
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    helpFromDat.length > 0
      ? `Official in-game HELP text (from adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}, for when the user asks for instructions or hints):\n${helpFromDat}\n\n`
      : "";
  const recentBlock =
    recentGameText && recentGameText.trim().length > 0
      ? `Recent game output (use this to resolve "it", "them", and implied objects; prefer nouns that appear here):\n---\n${recentGameText.trim().slice(-2500)}\n---\n\n`
      : "";
  return `${ADVENTURE_LLM_INTERPRET_ROLE}
${helpBlock}${recentBlock}Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.
Put the verb in primaryToken and the object or direction in secondaryToken when both apply.
${ADVENTURE_LLM_PARSER_TOKEN_RULES}

${adventureLlmInterpretJsonFooter()}`;
}

export function buildAutoplayPlannerPrompt(
  db: AdventureDatabase,
  plannerUserPrompt: string,
): string {
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    helpFromDat.length > 0
      ? `Official in-game HELP (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}):\n${helpFromDat}\n\n`
      : "";
  return `${helpBlock}${plannerUserPrompt}

${adventureLlmAutoplayJsonFooter()}`;
}
