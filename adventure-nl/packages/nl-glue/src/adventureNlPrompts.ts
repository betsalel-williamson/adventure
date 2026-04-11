import type { AdventureDatabase } from "./dat/types.js";
import { getHelpInstructionText, HELP_RTEXT_MESSAGE_ID } from "./text/speak.js";
import { buildVocabHint } from "./vocabHint.js";
import type {
  InterpretPromptStyleOverrides,
  PlannerUserPromptInput,
  TextLlmProviderId,
} from "./textLlmContract.js";
import {
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
  LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
} from "./llmPackagingConstants.js";
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

/** Options for planner HELP + compact shaping (autoplay only). */
export type AutoplayPlannerBuildOptions = {
  compact?: boolean;
  /** When false, omit adventure.dat RTEXT HELP prepended to planner system. Default true. */
  includeDatHelpInSystem?: boolean;
};

// -----------------------------------------------------------------------------
// Single source of instruction text for all TextLlm providers (Google, HTTP, MLX).
// -----------------------------------------------------------------------------

/**
 * Append EXAMPLES from `packages/nl-glue/fixtures/interpret-eval-fixtures.json` (fixtures with
 * `includeInPrompt !== false`) when enabled.
 *
 * - `ADVENTURE_NL_INTERPRET_PROMPT_EXAMPLES=1` / `true` / `yes` → on
 * - `=0` / `false` / `no` → off
 * - **Unset:** on for **`providerId === "mlx"`** only (eval-backed default for small Gemma); off for
 *   other providers or when `providerId` is omitted
 */
/** When true, interpret prompts omit few-shot EXAMPLES (lower latency). */
export function resolveFastInterpretPrompt(): boolean {
  const v = process.env.ADVENTURE_NL_FAST_INTERPRET?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveInterpretPromptExamples(
  providerId?: TextLlmProviderId,
): boolean {
  if (resolveFastInterpretPrompt()) return false;
  const v =
    process.env.ADVENTURE_NL_INTERPRET_PROMPT_EXAMPLES?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return providerId === "mlx";
}

/**
 * One line for **compact** interpret only (full prompts embed RTEXT HELP). Stops NEED, WHAT, etc.
 * from being chosen instead of HELP.
 */
export const ADVENTURE_NL_INTERPRET_COMPACT_HELP_HINT =
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
export const ADVENTURE_NL_INTERPRET_ROLE =
  "You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).";

/** Shorter role for small local models (MLX): less preamble, same task. */
export const ADVENTURE_NL_INTERPRET_ROLE_COMPACT =
  "Map the user's line to Colossal Cave Adventure parser tokens (max 5 letters each). Reply with JSON only.";

/**
 * Shared parser semantics for NL interpret and autoplay — keep in sync everywhere.
 * (primaryToken / secondaryToken / TAKE vs motion UP / TOUCH, etc.)
 */
export const ADVENTURE_NL_PARSER_TOKEN_RULES = `Rules: (1) For taking or carrying something, use primaryToken **TAKE** or **GET** with the object in **secondaryToken** (object words belong in secondary, not alone in primary). (2) The word **UP** in column 1 alone means **GO UP** (a direction), not the phrasal verb in "pick it up" / "pick them up"; those map to **TAKE** + object; **secondaryToken** must be a concrete object word from recent game output (e.g. **KEYS**), not **UP**, **THEM**, or **IT**. (3) For compass and travel, put only the direction in **primaryToken** and omit **secondaryToken** (e.g. **EAST** alone — not **GO** + direction in two columns). (4) **Never** put two travel or direction words in **primaryToken** and **secondaryToken** (invalid: **WEST** + **UP**, **NORTH** + **EAST**). The second column is for object nouns with verbs like **TAKE**/**OPEN**, not a second move. (5) "Pick up" phrasing prefers **TAKE**; bare "get"/"grab" may use **GET** when the object matches. (6) For picking up items, prefer **TAKE** or **GET** over **TOUCH** (often more helpful). (7) Use concrete secondaries from game text; skip **NULL** or placeholder secondaries. (8) If the transcript lists portable objects in the room and **INVENTORY** does not show you already carrying them (or inventory is empty/unknown), **prefer TAKE or GET + that object in secondaryToken** before **OUT**, **BUILD**, **LEAVE**, **EXIT**, or other travel. When you are **inside** a **building** or **well house**, or a compass move gets **no way to go that direction** while **inside**, **prefer OUT**, **BUILD**, **LEAVE**, **EXIT**, and other motion words from **CANDIDATES** (after **TAKE**/**GET** for anything you still need) until room text reads like open terrain (roads, forest, compass exits).`;

/** Minimal rules for small models (same distinctions, fewer tokens). */
export const ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT =
  'Rules: TAKE/GET + object in secondary (never object-only primary). Pick-up → prefer TAKE; "get" may be GET. Secondary must be a concrete noun from recent game text (KEYS, …), not THEM/IT/UP. UP in column1 alone = direction, not pick-up. Motion: one direction in primary only (EAST…); never two motions (no WEST+UP). Secondary is for object nouns with verbs, not a second move. Prefer TAKE/GET over TOUCH. No NULL secondaries. Indoors: if room lists items you are not carrying, TAKE/GET+object before OUT/BUILD/LEAVE/EXIT; then prefer OUT/BUILD/LEAVE/EXIT over compass until open terrain.';

/**
 * Dense autoplay planner copy for SLMs: replaces long prose + duplicate strategy paragraphs.
 * (Interpret prompts still use {@link ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT}.)
 */
export const ADVENTURE_NL_AUTOPLAY_RULES_SLM = `**Rules:**
1. Five-letter tokens only (e.g. EXAMI, STREA).
2. Movement: primaryToken only — no secondary. Pick from **Cand_Move**.
3. Actions: primaryToken from **Cand_Act** + secondaryToken = noun from **Items** or **Cand_Obj**.
4. Priority: (1) TAKE room items you do not carry. (2) Prefer **Cand_Move** entries that **Hist** shows as (OK) or untried; avoid repeating (No path)/(Reject). (3) Indoors, OUT/BUILD/LEAVE before raw compass until terrain opens up.

**Constraints:**
- Do not put THEM, IT, or UP in secondary.
- Do not use two travel primaries (invalid: WEST + UP).
- Do not use placeholder secondaries.
- **Wrong:** {"primaryToken":"NORTH","secondaryToken":"NORTH"}
- **Right:** {"primaryToken":"NORTH"}`;

/** Appended to compact MLX **system** when {@link mlxAutoplaySystemPromptForVariant} gets `lootFunnelActive`. */
export const ADVENTURE_NL_AUTOPLAY_LOOT_FUNNEL_SYSTEM_SLM = `**Loot gate (this turn):** **Items** lists ground objects you are not yet carrying. You MUST output {"primaryToken":"TAKE","secondaryToken":"<item>"} (or GET, same shape) for one of those objects. Do not emit travel-only JSON until **Items** is (none visible). **Cand_Move** is hidden — use **Cand_Act**/**Cand_Obj** only.`;

/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export const ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE =
  "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";

export const ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE_COMPACT =
  "You are the adventurer. Choose the next parser command. Reply ONLY with JSON; keys are repeated at the end of the prompt.";

/** `explore` — shorter prompts, exploration-first default; `full` — legacy richer guidance. */
export type AutoplayPromptMode = "explore" | "full";

/**
 * `ADVENTURE_NL_AUTOPLAY_PROMPT_MODE=explore` (default) or `full`.
 * Explore mode prioritizes visiting new rooms and varying commands; full preserves longer loot/indoor hints.
 */
export function resolveAutoplayPromptMode(): AutoplayPromptMode {
  const v = process.env.ADVENTURE_NL_AUTOPLAY_PROMPT_MODE?.trim().toLowerCase();
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
  if (compact) {
    return `Colossal Cave GETIN planner. Reply with one JSON object only (no markdown).

${ADVENTURE_NL_AUTOPLAY_RULES_SLM}

Shapes: travel {"primaryToken":"NORTH"} — action {"primaryToken":"TAKE","secondaryToken":"KEYS"}
Use only primaryToken + secondaryToken when needed. Shorter JSON is better.`;
  }

  const rules = ADVENTURE_NL_PARSER_TOKEN_RULES;
  const bodyExplore = `Default goal: **explore** — rotate motion using **Exits**, **History**, and **CANDIDATES**. **TAKE**/**GET** + object when **Items here** / room text shows ground items you are not carrying; **OUT**/**BUILD**/**LEAVE**/**EXIT** help indoors. **LOOK**/**EXAMI** when you need exact object wording.`;

  const bodyFull = `Prefer tokens from **CANDIDATES** when they fit; use **Location**, **Inventory**, **Items here**, and **Exits** to pick commands that advance the session. When the situation names takeable items you are not carrying, use **TAKE** or **GET** with that object before **OUT**, **BUILD**, **LEAVE**, or **EXIT**. Use **LOOK** or **EXAMI** when you need wording or detail is thin.`;

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
 * Set `ADVENTURE_NL_MLX_SYSTEM_VARIANT` to `full` | `compact` | `core` | `bare` (default `full`).
 */
export function resolveMlxSystemPromptVariant(): MlxSystemPromptVariant {
  const v = process.env.ADVENTURE_NL_MLX_SYSTEM_VARIANT?.trim().toLowerCase();
  if (v === "compact" || v === "core" || v === "bare") {
    return v;
  }
  return "full";
}

/** Shortest variant: title + rules + JSON example only (no extra paragraphs). */
function mlxAutoplaySystemPromptBare(compact: boolean): string {
  const rules = compact
    ? ADVENTURE_NL_AUTOPLAY_RULES_SLM
    : ADVENTURE_NL_PARSER_TOKEN_RULES;
  const example = compact
    ? `Example: {"primaryToken":"NORTH"} or {"primaryToken":"TAKE","secondaryToken":"KEYS"}`
    : `Example: {"primaryToken":"TOKEN","secondaryToken":"TOKEN","confidence":0.5,"continuePlaying":true}`;
  return `Colossal Cave GETIN planner. Reply with one JSON object only (no markdown).

${rules}

${example}`;
}

/**
 * System prompt for MLX autoplay (and merged single-string prompts). Variant controls length/structure
 * for experiments with small models (see {@link resolveMlxSystemPromptVariant}).
 * The user message carries **Location**, **Exits**, **History**, **CANDIDATES**, and related fields — not a full game transcript.
 */
export function mlxAutoplaySystemPromptForVariant(
  compact: boolean,
  variant: MlxSystemPromptVariant,
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
  lootFunnelActive?: boolean,
): string {
  const core = mlxAutoplayPlannerInstructionsBlock(compact, mode);
  let result: string;
  switch (variant) {
    case "bare":
      result = mlxAutoplaySystemPromptBare(compact);
      break;
    case "core":
      result = core;
      break;
    case "compact":
      result = compact
        ? `SLM autoplay.\n\n${core}`
        : `Colossal Cave Adventure — autoplay planner

${core}`;
      break;
    case "full":
      if (compact) {
        result =
          mode === "explore"
            ? `JSON GETIN planner. User = **Loc**, **Cand**, **Hist** (not a full log).\n\n${core}`
            : `JSON GETIN planner. User = local fields + **Cand**.\n\n${core}`;
        break;
      }
      if (mode === "explore") {
        result = `Colossal Cave Adventure — autoplay planner

You output one JSON GETIN command per turn. The **user** message is **local**: location, inventory, exits, short history, and token lists — not a full transcript.

${core}`;
        break;
      }
      result = `Colossal Cave Adventure — autoplay planner

You simulate the adventurer's input to the classic Fortran GETIN parser (five-letter vocabulary tokens). Each turn you must output exactly one JSON object for the next command.

The user message gives **Location**, **Description**, **Inventory**, **Items here**, **Exits**, **Breadcrumb**, **History**, optional **Alerts**, and **CANDIDATES** (suggested primary tokens). There is no full verbatim game log. Use that context to choose one valid command; **prioritize** untried **Exits** and suitable verbs/objects from **CANDIDATES** and **Items here**.

${core}`;
      break;
  }
  if (lootFunnelActive === true && compact) {
    return `${result.trim()}\n\n${ADVENTURE_NL_AUTOPLAY_LOOT_FUNNEL_SYSTEM_SLM}`;
  }
  return result;
}

export function mlxAutoplaySystemPrompt(
  compact: boolean,
  mode: AutoplayPromptMode = resolveAutoplayPromptMode(),
  lootFunnelActive?: boolean,
): string {
  return mlxAutoplaySystemPromptForVariant(
    compact,
    resolveMlxSystemPromptVariant(),
    mode,
    lootFunnelActive,
  );
}

/**
 * Appends a single comma-separated vocabulary line for MLX/split planner **system** prompts
 * (keeps token gloss out of the user turn).
 */
export function appendFlatVocabularyToPlannerSystem(
  systemBase: string,
  vocabularyFlat: string | undefined,
): string {
  const v = vocabularyFlat?.trim();
  if (!v) return systemBase.trim();
  return `${systemBase.trim()}\n\n**Vocabulary (parser tokens):** ${v}`;
}

/** Same caps as embedded recent-game text in {@link buildInterpretSystemAndUserPrompt}. */
export function recentGameCharsCapForInterpret(compact: boolean): number {
  return compact
    ? LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT
    : LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL;
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
 * Set `ADVENTURE_NL_COMPACT_PROMPTS=0` to use full prompts on MLX, or `=1` to force compact on any provider.
 */
export function resolveCompactPrompts(providerId: TextLlmProviderId): boolean {
  const v = process.env.ADVENTURE_NL_COMPACT_PROMPTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return providerId === "mlx";
}

/**
 * Markdown `###` dashboard sections (state first, then task) for small local models.
 * Default **on** for MLX only. Set `ADVENTURE_NL_STRUCTURED_PROMPTS=0` to disable on MLX.
 */
export function resolveStructuredDashboardPrompts(
  providerId: TextLlmProviderId,
): boolean {
  const v = process.env.ADVENTURE_NL_STRUCTURED_PROMPTS?.trim().toLowerCase();
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
Explore: one JSON object (primaryToken required). Use **Cand_Move**/**Cand_Act**; use **Hist** (OK)/(No path)/(Reject) to avoid repeating failed moves. **TAKE**/**GET** + object for ground items you do not carry. No markdown fences.`;
  }
  return `### TASK
Choose the next Colossal Cave Adventure parser command. Reply with **only** one JSON object: primaryToken (string, required), secondaryToken (optional), confidence (optional), continuePlaying (optional, default true). Use vocabulary from the lists below; follow parser rules. Use **Location**, **Exits**, **Items here**, and **INVENTORY (parsed)** to **prioritize** commands that advance the session. If **INVENTORY** or room text suggests items you do not carry, prefer **TAKE**/**GET** + object before exiting or traveling. **LOOK**/**EXAMI** when you need exact object wording. No markdown fences, no other text.`;
}

/** Single TASK block for structured NL interpret. */
export function interpretTaskBlockStructured(): string {
  return `### TASK
Map the player line to parser tokens (max 5 letters each, like the original game). Reply with **only** one JSON object: primaryToken (string, required), secondaryToken (optional), confidence (optional). No markdown fences, no other text.`;
}

/**
 * Vocabulary word count embedded in NL / autoplay prompts.
 * Override with `ADVENTURE_NL_VOCAB_HINT_MAX` (8–500).
 * When `compact` is true and env is unset, uses fewer words (48 vs 120).
 */
export function resolveVocabHintMaxWords(compact: boolean): number {
  const v = process.env.ADVENTURE_NL_VOCAB_HINT_MAX?.trim();
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
    ? ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE_COMPACT
    : ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE;
  const rules = compact
    ? ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_NL_PARSER_TOKEN_RULES;
  const vocabHeader = structured
    ? compact
      ? "### Vocabulary (parser tokens)"
      : "### Vocabulary (words the game parser accepts, grouped by kind)"
    : compact
      ? "## Vocabulary (parser tokens)"
      : "## Vocabulary (words the game parser accepts, grouped by kind)";
  const exploreLine =
    mode === "explore"
      ? "Default: explore — untried **Exits** and **CANDIDATES** first; **TAKE**/**GET** + object for ground items you are not carrying; **OUT**/**BUILD**/**LEAVE**/**EXIT** when indoors and compass stalls. **LOOK**/**EXAMI** when you need object wording or missing room detail."
      : "Use **Exits**, **Breadcrumb**, and **CANDIDATES** to prioritize motion and verbs not yet exhausted from the current situation. If the transcript lists portable objects you are not carrying, prefer **TAKE**/**GET** + object before indoor exits (**OUT**/**BUILD**/**LEAVE**/**EXIT**). **LOOK**/**EXAMI** when you need exact object tokens or room text is still thin.";
  return [
    role,
    compact
      ? "Prefer tokens from the vocabulary list and from **CANDIDATES** in the prompt."
      : "Use only vocabulary words from the grouped lists when possible.",
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
    ? ADVENTURE_NL_INTERPRET_ROLE_COMPACT
    : ADVENTURE_NL_INTERPRET_ROLE;
  const rules = compact
    ? ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT
    : ADVENTURE_NL_PARSER_TOKEN_RULES;

  const examplesSection = resolveInterpretPromptExamples(providerId)
    ? buildInterpretEvalExamplesSection(loadInterpretEvalFixtures(), {
        structuredDashboard: structured,
      })
    : "";
  const examplesSep =
    examplesSection.length > 0 ? `${examplesSection}\n\n` : "";

  const compactHelpCue = compact
    ? `${ADVENTURE_NL_INTERPRET_COMPACT_HELP_HINT}\n\n`
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
Put the verb in primaryToken and the object in secondaryToken for verb+noun commands (e.g. TAKE LAMP). For travel, use one motion/direction word in primaryToken only; do not put a direction in secondaryToken.
${rules}

${examplesSep}${adventureLlmInterpretJsonFooter()}`;
}

/**
 * Prepends optional HELP from adventure.dat to the system side only (Gemma: instructions first).
 */
export function buildAutoplayPlannerPromptParts(
  db: AdventureDatabase,
  parts: { system: string; user: string },
  options?: AutoplayPlannerBuildOptions,
): { system: string; user: string } {
  const compact = options?.compact ?? false;
  const includeHelp = options?.includeDatHelpInSystem !== false;
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    includeHelp && !compact && helpFromDat.length > 0
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
  options?: AutoplayPlannerBuildOptions,
): string {
  const compact = options?.compact ?? false;
  const includeHelp = options?.includeDatHelpInSystem !== false;
  if (typeof plannerUserPrompt === "string") {
    const helpFromDat = getHelpInstructionText(db);
    const helpBlock =
      includeHelp && !compact && helpFromDat.length > 0
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

function capForSse(s: string): string {
  if (s.length <= LLM_PACKAGING_SSE_PROMPT_CAP_CHARS) return s;
  return `${s.slice(0, LLM_PACKAGING_SSE_PROMPT_CAP_CHARS - 48)}\n…\n[truncated for SSE cap]`;
}

/**
 * Same strings the provider will send (after HELP merge and JSON footer for merged blob).
 * Used by the web dashboard SSE and logs.
 */
export function effectivePlannerSendPayload(
  db: AdventureDatabase,
  providerId: TextLlmProviderId,
  plannerUserPrompt: PlannerUserPromptInput,
  options: {
    compact: boolean;
    /** MLX + dashboard structured split: system/user to worker separately. */
    structuredSplit: boolean;
    includeDatHelpInSystem: boolean;
    /** When true, cap `fullSystem` / `fullUser` / `merged` for SSE payloads. */
    capForEventStream?: boolean;
  },
): {
  fullSystem?: string;
  fullUser?: string;
  merged: string;
  userPreview: string;
  systemPreview?: string;
} {
  const buildOpts: AutoplayPlannerBuildOptions = {
    compact: options.compact,
    includeDatHelpInSystem: options.includeDatHelpInSystem,
  };
  const cap = options.capForEventStream === true;
  const wrap = (x: string) => (cap ? capForSse(x) : x);

  if (
    providerId === "mlx" &&
    options.structuredSplit &&
    typeof plannerUserPrompt === "object"
  ) {
    const parts = buildAutoplayPlannerPromptParts(
      db,
      plannerUserPrompt,
      buildOpts,
    );
    const merged = `${parts.system}\n\n${parts.user}`;
    const fullSystem = wrap(parts.system);
    const fullUser = wrap(parts.user);
    const maxU = LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS;
    const maxS = LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS;
    return {
      fullSystem,
      fullUser,
      merged: wrap(merged),
      userPreview:
        parts.user.length <= maxU
          ? parts.user
          : `${parts.user.slice(0, maxU)}…`,
      systemPreview:
        parts.system.length <= maxS
          ? parts.system
          : `${parts.system.slice(0, maxS)}…`,
    };
  }

  const mergedRaw = buildAutoplayPlannerPrompt(
    db,
    plannerUserPrompt,
    buildOpts,
  );
  const merged = wrap(mergedRaw);
  const maxU = LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS;
  return {
    merged,
    userPreview:
      mergedRaw.length <= maxU ? mergedRaw : `${mergedRaw.slice(0, maxU)}…`,
  };
}
