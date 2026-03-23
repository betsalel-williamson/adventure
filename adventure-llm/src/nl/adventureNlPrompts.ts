import type { AdventureDatabase } from "../dat/types.js";
import {
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "../text/speak.js";
import type { TextLlmProviderId } from "./textLlmContract.js";
import { buildVocabHint } from "./vocabHint.js";

// -----------------------------------------------------------------------------
// Single source of instruction text for all TextLlm providers (Google, HTTP, MLX).
// -----------------------------------------------------------------------------

/** NL interpret: opening role (maps free text → parser tokens). */
export const ADVENTURE_LLM_INTERPRET_ROLE =
  "You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).";

/** Shorter role for small local models (MLX): less preamble, same task. */
export const ADVENTURE_LLM_INTERPRET_ROLE_COMPACT =
  "Map the user's line to Colossal Cave Adventure parser tokens (max 5 letters each). Reply with JSON only.";

/**
 * Shared parser semantics for NL interpret and autoplay — keep in sync everywhere.
 * (primaryToken / secondaryToken / TAKE vs motion UP / TOUCH, etc.)
 */
export const ADVENTURE_LLM_PARSER_TOKEN_RULES = `Rules: (1) For taking or carrying something, use primaryToken TAKE or GET and put the object in secondaryToken — never put the object alone in primaryToken. (2) The word UP in column 1 alone means GO UP (a direction), NOT the phrasal verb in "pick it up" / "pick them up"; those mean TAKE + object. (3) For picking up items, prefer TAKE or GET over TOUCH (TOUCH often yields an unhelpful game response). (4) Do not use NULL or placeholder secondaries.`;

/** Minimal rules for small models (same distinctions, fewer tokens). */
export const ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT =
  'Rules: TAKE or GET + object in secondaryToken (not alone in primary). UP alone = direction, not "pick up". Prefer TAKE over TOUCH. No NULL secondaries.';

/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE =
  "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";

export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT =
  "You are the adventurer. Choose the next parser command. Reply ONLY with JSON; keys are repeated at the end of the prompt.";

const RECENT_GAME_CHARS_FULL = 2500;
const RECENT_GAME_CHARS_COMPACT = 1200;

/**
 * When unset: compact prompts default **on** for MLX only (smaller local models).
 * Set `ADVENTURE_LLM_COMPACT_PROMPTS=0` to use full prompts on MLX, or `=1` to force compact on any provider.
 */
export function resolveCompactPrompts(providerId: TextLlmProviderId): boolean {
  const v = process.env.ADVENTURE_LLM_COMPACT_PROMPTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return providerId === "mlx";
}

/**
 * Vocabulary word count embedded in NL / autoplay prompts.
 * Override with `ADVENTURE_LLM_VOCAB_HINT_MAX` (8–500).
 * When `compact` is true and env is unset, uses fewer words (48 vs 120).
 */
export function resolveVocabHintMaxWords(compact: boolean): number {
  const v = process.env.ADVENTURE_LLM_VOCAB_HINT_MAX?.trim();
  if (v !== undefined && v !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 8 && n <= 500) return Math.floor(n);
  }
  return compact ? 48 : 120;
}

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
  options?: { compact?: boolean },
): string[] {
  const compact = options?.compact ?? false;
  const role = compact
    ? ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT
    : ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE;
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  return [
    role,
    "Use only vocabulary words from the list when possible.",
    rules,
    "",
    "## Vocabulary (words the game parser accepts)",
    vocabSectionText,
  ];
}

export function buildInterpretSystemAndUserPrompt(
  db: AdventureDatabase,
  userText: string,
  recentGameText: string | undefined,
  options?: { compact?: boolean },
): string {
  const compact = options?.compact ?? false;
  const maxWords = resolveVocabHintMaxWords(compact);
  const hint = buildVocabHint(db, maxWords);
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    !compact && helpFromDat.length > 0
      ? `Official in-game HELP text (from adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}, for when the user asks for instructions or hints):\n${helpFromDat}\n\n`
      : "";
  const recentCap = compact
    ? RECENT_GAME_CHARS_COMPACT
    : RECENT_GAME_CHARS_FULL;
  const recentBlock =
    recentGameText && recentGameText.trim().length > 0
      ? `Recent game output (use this to resolve "it", "them", and implied objects; prefer nouns that appear here):\n---\n${recentGameText.trim().slice(-recentCap)}\n---\n\n`
      : "";
  const role = compact
    ? ADVENTURE_LLM_INTERPRET_ROLE_COMPACT
    : ADVENTURE_LLM_INTERPRET_ROLE;
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  return `${role}
${helpBlock}${recentBlock}Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.
Put the verb in primaryToken and the object or direction in secondaryToken when both apply.
${rules}

${adventureLlmInterpretJsonFooter()}`;
}

export function buildAutoplayPlannerPrompt(
  db: AdventureDatabase,
  plannerUserPrompt: string,
  options?: { compact?: boolean },
): string {
  const compact = options?.compact ?? false;
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    !compact && helpFromDat.length > 0
      ? `Official in-game HELP (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}):\n${helpFromDat}\n\n`
      : "";
  return `${helpBlock}${plannerUserPrompt}

${adventureLlmAutoplayJsonFooter()}`;
}
