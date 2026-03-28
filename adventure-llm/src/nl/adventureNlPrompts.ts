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
/** When true, interpret prompts omit few-shot EXAMPLES (lower latency). */
export function resolveFastInterpretPrompt(): boolean {
  const v = process.env.ADVENTURE_LLM_FAST_INTERPRET?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveInterpretPromptExamples(
  providerId?: TextLlmProviderId,
): boolean {
  if (resolveFastInterpretPrompt()) return false;
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
export const ADVENTURE_LLM_PARSER_TOKEN_RULES = `Rules: (1) For taking or carrying something, use primaryToken **TAKE** or **GET** with the object in **secondaryToken** (object words belong in secondary, not alone in primary). (2) The word **UP** in column 1 alone means **GO UP** (a direction), not the phrasal verb in "pick it up" / "pick them up"; those map to **TAKE** + object; **secondaryToken** must be a concrete object word from recent game output (e.g. **KEYS**), not **UP**, **THEM**, or **IT**. (3) For compass and travel, put only the direction in **primaryToken** and omit **secondaryToken** (e.g. **EAST** alone — not **GO** + direction in two columns). (4) "Pick up" phrasing prefers **TAKE**; bare "get"/"grab" may use **GET** when the object matches. (5) For picking up items, prefer **TAKE** or **GET** over **TOUCH** (often more helpful). (6) Use concrete secondaries from game text; skip **NULL** or placeholder secondaries. (7) If the transcript lists portable objects in the room and **INVENTORY** does not show you already carrying them (or inventory is empty/unknown), **prefer TAKE or GET + that object in secondaryToken** before **OUT**, **BUILD**, **LEAVE**, **EXIT**, or other travel. When you are **inside** a **building** or **well house**, or a compass move gets **no way to go that direction** while **inside**, **prefer OUT**, **BUILD**, **LEAVE**, **EXIT**, and other motion words from **CANDIDATES** (after **TAKE**/**GET** for anything you still need) until room text reads like open terrain (roads, forest, compass exits).`;

/** Minimal rules for small models (same distinctions, fewer tokens). */
export const ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT =
  'Rules: TAKE/GET + object in secondary (never object-only primary). Pick-up → prefer TAKE; "get" may be GET. Secondary must be a concrete noun from recent game text (KEYS, …), not THEM/IT/UP. UP in column1 alone = direction, not pick-up. Motion: direction-only primary (EAST…), no GO+secondary. Prefer TAKE/GET over TOUCH. No NULL secondaries. Indoors: if room lists items you are not carrying, TAKE/GET+object before OUT/BUILD/LEAVE/EXIT; then prefer OUT/BUILD/LEAVE/EXIT over compass until open terrain.';

/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE =
  "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";

export const ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT =
  "You are the adventurer. Choose the next parser command. Reply ONLY with JSON; keys are repeated at the end of the prompt.";

/** `explore` — shorter prompts, exploration-first default; `full` — legacy richer guidance. */
export type AutoplayPromptMode = "explore" | "full";

/**
 * `ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE=explore` (default) or `full`.
 * Explore mode prioritizes visiting new rooms and varying commands; full preserves longer loot/indoor hints.
 */
export function resolveAutoplayPromptMode(): AutoplayPromptMode {
  const v =
    process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE?.trim().toLowerCase();
  if (v === "full") return "full";
  return "explore";
}

/**
 * Core task + JSON contract for autoplay (embedded in {@link mlxAutoplaySystemPrompt}).
 */
export function mlxAutoplayPlannerInstructionsBlock(
  compact: boolean,
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
): string {
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  const bodyExplore = `Default goal: **explore** — **rotate** motion and interaction: **Try next**, **AT THIS NODE**, and **CANDIDATES** show what is still worth trying from this position. **TAKE**/**GET** + object when **INVENTORY** / room text shows ground items you are not carrying yet; when you already hold an item, pick travel or another interaction. **OUT**/**BUILD**/**LEAVE**/**EXIT** help indoors (see user message). **LOOK**/**EXAMI** when you need exact object wording.`;

  const bodyFull = `Prefer tokens from **CANDIDATES** when they fit; use **EXPLORATION MAP** / **INVENTORY** to pick commands that advance the situation. When the transcript names takeable items you are not carrying, use **TAKE** or **GET** with that object noun before travel or indoor exits (**OUT**, **BUILD**, **LEAVE**, **EXIT**). When the transcript already shows where you are and what is present, choose travel or **TAKE**/**GET** (or another interaction); use **LOOK** or **EXAMI** when you need wording for an object or the situation text is missing or clearly stale.`;

  const body = mode === "explore" ? bodyExplore : bodyFull;

  return `Choose the next GETIN parser command (two five-letter columns max).

${rules}

${body}

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
 * The user message carries **GAME ENGINE STATE**, **CANDIDATES**, and **LOCAL SESSION MAP** (DOT), not a full game transcript.
 */
export function mlxAutoplaySystemPromptForVariant(
  compact: boolean,
  variant: MlxSystemPromptVariant,
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
): string {
  const core = mlxAutoplayPlannerInstructionsBlock(compact, mode);
  switch (variant) {
    case "bare":
      return mlxAutoplaySystemPromptBare(compact);
    case "core":
      return core;
    case "compact":
      return `Colossal Cave Adventure — autoplay planner

${core}`;
    case "full":
      if (mode === "explore") {
        return `Colossal Cave Adventure — autoplay planner

You output one JSON GETIN command per turn. The **user** message is **local**: current node, short history, optional small map — not a full transcript.

${core}`;
      }
      return `Colossal Cave Adventure — autoplay planner

You simulate the adventurer's input to the classic Fortran GETIN parser (five-letter vocabulary tokens). Each turn you must output exactly one JSON object for the next command.

The user message describes the current situation: **GAME ENGINE STATE** (location, parsed inventory, alerts), **EXPLORATION MAP** (inferred x,y,z and session learnings at the current cell), **CANDIDATES** (suggested tokens), and **LOCAL SESSION MAP** (small Graphviz DOT around your current inferred cell — the **dark filled** node with **YOU ARE HERE** in the label is your position). There is no full verbatim game log. Use that context to choose one valid command; **prioritize** exits and verbs that are still open on the map (**Try next**).

${core}`;
  }
}

export function mlxAutoplaySystemPrompt(
  compact: boolean,
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
): string {
  return mlxAutoplaySystemPromptForVariant(
    compact,
    resolveMlxSystemPromptVariant(),
    mode,
  );
}

const RECENT_GAME_CHARS_FULL = 2500;
const RECENT_GAME_CHARS_COMPACT = 1200;

/** Same caps as embedded recent-game text in {@link buildInterpretSystemAndUserPrompt}. */
export function recentGameCharsCapForInterpret(compact: boolean): number {
  return compact ? RECENT_GAME_CHARS_COMPACT : RECENT_GAME_CHARS_FULL;
}

/**
 * Tail slice of `recentGameText` actually embedded in the interpret prompt (for cache keys).
 * Must match the `recentSlice` logic in {@link buildInterpretSystemAndUserPrompt}.
 */
export function recentGameTextSliceForInterpretPrompt(
  recentGameText: string | undefined,
  compact: boolean,
): string {
  const recentCap = recentGameCharsCapForInterpret(compact);
  return recentGameText && recentGameText.trim().length > 0
    ? recentGameText.trim().slice(-recentCap)
    : "";
}

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
export function autoplayPlannerTaskBlockStructured(
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
): string {
  if (mode === "explore") {
    return `### TASK
Default goal: **explore the world** (new rooms, untried exits). Reply with **only** one JSON object: primaryToken (required), secondaryToken (optional), confidence (optional), continuePlaying (optional, default true). **Rotate** your choice: **Try next** and **AT THIS NODE** list strong options; **vary** from your last few turns at this spot when the situation is unchanged. Follow parser rules. **TAKE**/**GET** + object when room/inventory shows ground items you are not carrying. **LOOK**/**EXAMI** when you need exact object words. No markdown fences, no other text.`;
  }
  return `### TASK
Choose the next Colossal Cave Adventure parser command. Reply with **only** one JSON object: primaryToken (string, required), secondaryToken (optional), confidence (optional), continuePlaying (optional, default true). Use vocabulary from the lists below; follow parser rules. Use **EXPLORATION MAP**, **LOCAL SESSION MAP** (dark-filled **YOU ARE HERE** node = your current inferred cell), and **INVENTORY (parsed)** to **prioritize** commands that advance the session. If **INVENTORY** or room text suggests items you do not carry, prefer **TAKE**/**GET** + object before exiting or traveling. **LOOK**/**EXAMI** when you need exact object wording. No markdown fences, no other text.`;
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
  options?: {
    compact?: boolean;
    structuredDashboard?: boolean;
    autoplayPromptMode?: AutoplayPromptMode;
  },
): string[] {
  const compact = options?.compact ?? false;
  const structured = options?.structuredDashboard ?? false;
  const mode = options?.autoplayPromptMode ?? resolveAutoplayPromptMode();
  const role = compact
    ? ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT
    : ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE;
  const rules = compact
    ? ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_LLM_PARSER_TOKEN_RULES;
  const vocabHeader = structured
    ? "### Vocabulary (words the game parser accepts, grouped by kind)"
    : "## Vocabulary (words the game parser accepts, grouped by kind)";
  const exploreLine =
    mode === "explore"
      ? "Default: explore — **Try next** and untried exits first; **TAKE**/**GET** + object for ground items you are not carrying; **OUT**/**BUILD**/**LEAVE**/**EXIT** when indoors and compass stalls. **LOOK**/**EXAMI** when you need object wording or missing room detail."
      : "When the prompt includes an inferred **EXPLORATION MAP**, **prioritize** motion and interaction from **Try next** and tokens not yet listed as explored from the current cell. If the transcript lists portable objects you are not carrying, prefer **TAKE**/**GET** + object before indoor exits (**OUT**/**BUILD**/**LEAVE**/**EXIT**). **LOOK**/**EXAMI** when you need exact object tokens or room text is still thin.";
  return [
    role,
    "Use only vocabulary words from the grouped lists when possible.",
    exploreLine,
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
  const recentSlice = recentGameTextSliceForInterpretPrompt(
    recentGameText,
    compact,
  );
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
