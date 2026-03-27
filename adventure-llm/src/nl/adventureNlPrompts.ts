import type { AdventureDatabase } from "../dat/types.js";
import {
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "../text/speak.js";
import type {
  InterpretPromptStyleOverrides,
  PlannerUserPromptInput,
  TextLlmProviderId,
} from "./textLlmContract.js";
import { buildVocabHint } from "./vocabHint.js";
import {
  buildInterpretEvalExamplesSection,
  loadInterpretEvalFixtures,
} from "./interpretEvalFixtures.js";

/** Options for {@link buildInterpretSystemAndUserPrompt}. */
export type BuildInterpretPromptOptions = {
  compact?: boolean;
  structuredDashboard?: boolean;
  /** When set, MLX defaults interpret few-shot EXAMPLES on if env is unset. */
  providerId?: TextLlmProviderId;
};

// -----------------------------------------------------------------------------
// Single source of instruction text for all TextLlm providers (Google, HTTP, MLX).
// -----------------------------------------------------------------------------

/**
 * Append EXAMPLES from `scripts/interpret-eval-fixtures.json` (fixtures with
 * `includeInPrompt !== false`) when enabled.
 *
 * - `ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES=1` / `true` / `yes` → on
 * - `=0` / `false` / `no` → off
 * - **Unset:** on for **`providerId === "mlx"`** only (eval-backed default for small Gemma); off for
 *   other providers or when `providerId` is omitted
 */
export function resolveInterpretPromptExamples(
  providerId?: TextLlmProviderId,
): boolean {
  const v =
    process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return providerId === "mlx";
}

/**
 * One line for **compact** interpret only (full prompts embed RTEXT HELP). Stops NEED, WHAT, etc.
 * from being chosen instead of HELP.
 */
export const ADVENTURE_LLM_INTERPRET_COMPACT_HELP_HINT =
  "If the user asks for instructions, hints, or how to play, use primaryToken HELP and omit secondaryToken.";

/** Truncate RTEXT HELP for compact interpret (chars); keeps cue + token budget in check. */
const INTERPRET_COMPACT_HELP_RTEXT_MAX_CHARS = 900;

/**
 * Resolve compact + structured layout for interpret prompts (hosted/OpenAI-compatible providers).
 * MLX passes {@link InterpretPromptStyleOverrides} explicitly and falls back to instance + env in the provider.
 */
export function resolveInterpretPromptBuildOptions(
  providerId: TextLlmProviderId,
  overrides?: InterpretPromptStyleOverrides,
): { compact: boolean; structuredDashboard: boolean } {
  return {
    compact:
      overrides?.compact !== undefined
        ? overrides.compact
        : resolveCompactPrompts(providerId),
    structuredDashboard:
      overrides?.structuredDashboard !== undefined
        ? overrides.structuredDashboard
        : resolveStructuredDashboardPrompts(providerId),
  };
}

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
export const ADVENTURE_LLM_PARSER_TOKEN_RULES = `Rules: (1) For taking or carrying something, use primaryToken TAKE or GET and put the object in secondaryToken — never put the object alone in primaryToken. (2) The word UP in column 1 alone means GO UP (a direction), NOT the phrasal verb in "pick it up" / "pick them up"; those mean TAKE + object; secondaryToken must be a concrete object word from recent game output (e.g. KEYS), never UP, THEM, or IT. (3) For compass and travel directions (NORTH, EAST, WEST, SOUTH, etc.), put only the direction in primaryToken and omit secondaryToken — do not use GO, WALK, or RUN in primary with the direction in secondary. (4) "Pick up" phrasing prefers TAKE; bare "get"/"grab" may use GET when the object matches. (5) For picking up items, prefer TAKE or GET over TOUCH (TOUCH often yields an unhelpful game response). (6) Do not use NULL or placeholder secondaries.`;

/** Minimal rules for small models (same distinctions, fewer tokens). */
export const ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT =
  'Rules: TAKE/GET + object in secondary (never object-only primary). Pick-up → prefer TAKE; "get" may be GET. Secondary must be a concrete noun from recent game text (KEYS, …), not THEM/IT/UP. UP in column1 alone = direction, not pick-up. Motion: direction-only primary (EAST…), no GO+secondary. Prefer TAKE/GET over TOUCH. No NULL secondaries.';

/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE =
  "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";

export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT =
  "You are the adventurer. Choose the next parser command. Reply ONLY with JSON; keys are repeated at the end of the prompt.";

/**
 * Core task + JSON contract for autoplay (embedded in {@link mlxAutoplaySystemPrompt}).
 */
export function mlxAutoplayPlannerInstructionsBlock(compact: boolean): string {
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  return `Choose the next GETIN parser command (two five-letter columns max).

${rules}

Prefer tokens from **CANDIDATES** in the user message when they fit the situation.

Reply with one JSON object only (no markdown fences, no other text):
{"primaryToken":"TOKEN","secondaryToken":"TOKEN","confidence":0.5,"continuePlaying":true}

primaryToken is required (parser vocabulary). secondaryToken is optional. confidence is optional (0–1). continuePlaying defaults to true.`;
}

/** Experiment knobs for Gemma-2B (and other MLX) system prompt length/structure. */
export const MLX_SYSTEM_PROMPT_VARIANTS = [
  "full",
  "compact",
  "core",
  "bare",
] as const;

export type MlxSystemPromptVariant =
  (typeof MLX_SYSTEM_PROMPT_VARIANTS)[number];

/**
 * Selects system prompt shape for MLX autoplay.
 * Set `ADVENTURE_LLM_MLX_SYSTEM_VARIANT` to `full` | `compact` | `core` | `bare` (default `full`).
 */
export function resolveMlxSystemPromptVariant(): MlxSystemPromptVariant {
  const v = process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT?.trim().toLowerCase();
  if (v === "compact" || v === "core" || v === "bare") {
    return v;
  }
  return "full";
}

/** Shortest variant: title + rules + JSON example only (no extra paragraphs). */
function mlxAutoplaySystemPromptBare(compact: boolean): string {
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  return `Colossal Cave GETIN planner. Reply with one JSON object only (no markdown).

${rules}

Example: {"primaryToken":"TOKEN","secondaryToken":"TOKEN","confidence":0.5,"continuePlaying":true}`;
}

/**
 * System prompt for MLX autoplay (and merged single-string prompts). Variant controls length/structure
 * for experiments with small models (see {@link resolveMlxSystemPromptVariant}).
 * The user message carries **GAME ENGINE STATE**, **CANDIDATES**, **RECENT MOVES**, and **TRANSCRIPT**.
 */
export function mlxAutoplaySystemPromptForVariant(
  compact: boolean,
  variant: MlxSystemPromptVariant,
): string {
  const core = mlxAutoplayPlannerInstructionsBlock(compact);
  switch (variant) {
    case "bare":
      return mlxAutoplaySystemPromptBare(compact);
    case "core":
      return core;
    case "compact":
      return `Colossal Cave Adventure — autoplay planner

${core}`;
    case "full":
      return `Colossal Cave Adventure — autoplay planner

You simulate the adventurer's input to the classic Fortran GETIN parser (five-letter vocabulary tokens). Each turn you must output exactly one JSON object for the next command.

The user message describes the current situation: **GAME ENGINE STATE** (location, inventory, alerts), **CANDIDATES** (suggested tokens for this moment), **RECENT MOVES** (last commands and outcomes), and **TRANSCRIPT** (verbatim game text). Use that context to choose one valid command.

${core}`;
  }
}

export function mlxAutoplaySystemPrompt(compact: boolean): string {
  return mlxAutoplaySystemPromptForVariant(
    compact,
    resolveMlxSystemPromptVariant(),
  );
}

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
 * Markdown `###` dashboard sections (state first, then task) for small local models.
 * Default **on** for MLX only. Set `ADVENTURE_LLM_STRUCTURED_PROMPTS=0` to disable on MLX.
 */
export function resolveStructuredDashboardPrompts(
  providerId: TextLlmProviderId,
): boolean {
  const v = process.env.ADVENTURE_LLM_STRUCTURED_PROMPTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return providerId === "mlx";
}

/** Single TASK block for structured autoplay (JSON planner). */
export function autoplayPlannerTaskBlockStructured(): string {
  return `### TASK
Choose the next Colossal Cave Adventure parser command. Reply with **only** one JSON object: primaryToken (string, required), secondaryToken (optional), confidence (optional), continuePlaying (optional, default true). Use vocabulary from the lists below; follow parser rules. No markdown fences, no other text.`;
}

/** Single TASK block for structured NL interpret. */
export function interpretTaskBlockStructured(): string {
  return `### TASK
Map the player line to parser tokens (max 5 letters each, like the original game). Reply with **only** one JSON object: primaryToken (string, required), secondaryToken (optional), confidence (optional). No markdown fences, no other text.`;
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
  options?: { compact?: boolean; structuredDashboard?: boolean },
): string[] {
  const compact = options?.compact ?? false;
  const structured = options?.structuredDashboard ?? false;
  const role = compact
    ? ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT
    : ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE;
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  const vocabHeader = structured
    ? "### Vocabulary (words the game parser accepts, grouped by kind)"
    : "## Vocabulary (words the game parser accepts, grouped by kind)";
  return [
    role,
    "Use only vocabulary words from the grouped lists when possible.",
    rules,
    "",
    vocabHeader,
    vocabSectionText,
  ];
}

export function buildInterpretSystemAndUserPrompt(
  db: AdventureDatabase,
  userText: string,
  recentGameText: string | undefined,
  options?: BuildInterpretPromptOptions,
): string {
  const compact = options?.compact ?? false;
  const structured = options?.structuredDashboard ?? false;
  const providerId = options?.providerId;
  const maxWords = resolveVocabHintMaxWords(compact);
  const hint = buildVocabHint(db, maxWords, {
    grouped: true,
    structuredGroups: structured,
    compact,
  });
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    !compact && helpFromDat.length > 0
      ? `Official in-game HELP text (from adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}, for when the user asks for instructions or hints):\n${helpFromDat}\n\n`
      : "";
  const compactHelpBlock =
    compact && helpFromDat.length > 0
      ? `HELP excerpt (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}, truncated):\n${helpFromDat.slice(0, INTERPRET_COMPACT_HELP_RTEXT_MAX_CHARS)}${helpFromDat.length > INTERPRET_COMPACT_HELP_RTEXT_MAX_CHARS ? "…" : ""}\n\n`
      : "";
  const recentCap = compact
    ? RECENT_GAME_CHARS_COMPACT
    : RECENT_GAME_CHARS_FULL;
  const recentSlice =
    recentGameText && recentGameText.trim().length > 0
      ? recentGameText.trim().slice(-recentCap)
      : "";
  const role = compact
    ? ADVENTURE_LLM_INTERPRET_ROLE_COMPACT
    : ADVENTURE_LLM_INTERPRET_ROLE;
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;

  const examplesSection = resolveInterpretPromptExamples(providerId)
    ? buildInterpretEvalExamplesSection(loadInterpretEvalFixtures(), {
        structuredDashboard: structured,
      })
    : "";
  const examplesSep =
    examplesSection.length > 0 ? `${examplesSection}\n\n` : "";

  const compactHelpCue = compact
    ? `${ADVENTURE_LLM_INTERPRET_COMPACT_HELP_HINT}\n\n`
    : "";

  if (structured) {
    const recentSection =
      recentSlice.length > 0
        ? `### RECENT GAME OUTPUT
(use to resolve "it"/"them" to a concrete object in secondaryToken — noun from this text, e.g. KEYS; not THEM, IT, or UP)
---
${recentSlice}
---

`
        : "";
    return `${role}

${compactHelpCue}${interpretTaskBlockStructured()}
${helpBlock}${compactHelpBlock}${recentSection}### VOCABULARY HINT
${hint}

### PARSER RULES
${rules}

${examplesSep}### USER INPUT
${userText}

${adventureLlmInterpretJsonFooter()}`;
  }

  const recentBlock =
    recentSlice.length > 0
      ? `Recent game output (resolve "it"/"them" to a concrete object name in secondaryToken from this text; not THEM, IT, or UP):\n---\n${recentSlice}\n---\n\n`
      : "";
  return `${role}
${compactHelpCue}${helpBlock}${compactHelpBlock}${recentBlock}Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.
Put the verb in primaryToken and the object or direction in secondaryToken when both apply.
${rules}

${examplesSep}${adventureLlmInterpretJsonFooter()}`;
}

/**
 * Prepends optional HELP from adventure.dat to the system side only (Gemma: instructions first).
 */
export function buildAutoplayPlannerPromptParts(
  db: AdventureDatabase,
  parts: { system: string; user: string },
  options?: { compact?: boolean },
): { system: string; user: string } {
  const compact = options?.compact ?? false;
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    !compact && helpFromDat.length > 0
      ? `Official in-game HELP (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}):\n${helpFromDat}\n\n`
      : "";
  const system = helpBlock
    ? `${helpBlock}${parts.system.trim()}`.trim()
    : parts.system.trim();
  return { system, user: parts.user.trim() };
}

/**
 * Full planner string for providers that take a single blob (Google, HTTP).
 * For `{ system, user }`, concatenates without appending {@link adventureLlmAutoplayJsonFooter}
 * (the split system block already defines JSON keys).
 */
export function buildAutoplayPlannerPrompt(
  db: AdventureDatabase,
  plannerUserPrompt: PlannerUserPromptInput,
  options?: { compact?: boolean },
): string {
  const compact = options?.compact ?? false;
  if (typeof plannerUserPrompt === "string") {
    const helpFromDat = getHelpInstructionText(db);
    const helpBlock =
      !compact && helpFromDat.length > 0
        ? `Official in-game HELP (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}):\n${helpFromDat}\n\n`
        : "";
    return `${helpBlock}${plannerUserPrompt}

${adventureLlmAutoplayJsonFooter()}`;
  }
  const merged = buildAutoplayPlannerPromptParts(
    db,
    plannerUserPrompt,
    options,
  );
  return `${merged.system}\n\n${merged.user}`;
}
