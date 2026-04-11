import type { AdventureDatabase } from "./dat/types.js";
import type { InterpretPromptStyleOverrides, PlannerUserPromptInput, TextLlmProviderId } from "./textLlmContract.js";
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
export declare function resolveFastInterpretPrompt(): boolean;
export declare function resolveInterpretPromptExamples(providerId?: TextLlmProviderId): boolean;
/**
 * One line for **compact** interpret only (full prompts embed RTEXT HELP). Stops NEED, WHAT, etc.
 * from being chosen instead of HELP.
 */
export declare const ADVENTURE_NL_INTERPRET_COMPACT_HELP_HINT = "If the user asks for instructions, hints, or how to play, use primaryToken HELP and omit secondaryToken.";
/**
 * Resolve compact + structured layout for interpret prompts (hosted/OpenAI-compatible providers).
 * MLX passes {@link InterpretPromptStyleOverrides} explicitly and falls back to instance + env in the provider.
 */
export declare function resolveInterpretPromptBuildOptions(providerId: TextLlmProviderId, overrides?: InterpretPromptStyleOverrides): {
    compact: boolean;
    structuredDashboard: boolean;
};
/** NL interpret: opening role (maps free text → parser tokens). */
export declare const ADVENTURE_NL_INTERPRET_ROLE = "You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).";
/** Shorter role for small local models (MLX): less preamble, same task. */
export declare const ADVENTURE_NL_INTERPRET_ROLE_COMPACT = "Map the user's line to Colossal Cave Adventure parser tokens (max 5 letters each). Reply with JSON only.";
/**
 * Shared parser semantics for NL interpret and autoplay — keep in sync everywhere.
 * (primaryToken / secondaryToken / TAKE vs motion UP / TOUCH, etc.)
 */
export declare const ADVENTURE_NL_PARSER_TOKEN_RULES = "Rules: (1) For taking or carrying something, use primaryToken **TAKE** or **GET** with the object in **secondaryToken** (object words belong in secondary, not alone in primary). (2) The word **UP** in column 1 alone means **GO UP** (a direction), not the phrasal verb in \"pick it up\" / \"pick them up\"; those map to **TAKE** + object; **secondaryToken** must be a concrete object word from recent game output (e.g. **KEYS**), not **UP**, **THEM**, or **IT**. (3) For compass and travel, put only the direction in **primaryToken** and omit **secondaryToken** (e.g. **EAST** alone \u2014 not **GO** + direction in two columns). (4) **Never** put two travel or direction words in **primaryToken** and **secondaryToken** (invalid: **WEST** + **UP**, **NORTH** + **EAST**). The second column is for object nouns with verbs like **TAKE**/**OPEN**, not a second move. (5) \"Pick up\" phrasing prefers **TAKE**; bare \"get\"/\"grab\" may use **GET** when the object matches. (6) For picking up items, prefer **TAKE** or **GET** over **TOUCH** (often more helpful). (7) Use concrete secondaries from game text; skip **NULL** or placeholder secondaries. (8) If the transcript lists portable objects in the room and **INVENTORY** does not show you already carrying them (or inventory is empty/unknown), **prefer TAKE or GET + that object in secondaryToken** before **OUT**, **BUILD**, **LEAVE**, **EXIT**, or other travel. When you are **inside** a **building** or **well house**, or a compass move gets **no way to go that direction** while **inside**, **prefer OUT**, **BUILD**, **LEAVE**, **EXIT**, and other motion words from **CANDIDATES** (after **TAKE**/**GET** for anything you still need) until room text reads like open terrain (roads, forest, compass exits).";
/** Minimal rules for small models (same distinctions, fewer tokens). */
export declare const ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT = "Rules: TAKE/GET + object in secondary (never object-only primary). Pick-up \u2192 prefer TAKE; \"get\" may be GET. Secondary must be a concrete noun from recent game text (KEYS, \u2026), not THEM/IT/UP. UP in column1 alone = direction, not pick-up. Motion: one direction in primary only (EAST\u2026); never two motions (no WEST+UP). Secondary is for object nouns with verbs, not a second move. Prefer TAKE/GET over TOUCH. No NULL secondaries. Indoors: if room lists items you are not carrying, TAKE/GET+object before OUT/BUILD/LEAVE/EXIT; then prefer OUT/BUILD/LEAVE/EXIT over compass until open terrain.";
/**
 * Dense autoplay planner copy for SLMs: replaces long prose + duplicate strategy paragraphs.
 * (Interpret prompts still use {@link ADVENTURE_NL_PARSER_TOKEN_RULES_COMPACT}.)
 */
export declare const ADVENTURE_NL_AUTOPLAY_RULES_SLM = "**Rules:**\n1. Five-letter tokens only (e.g. EXAMI, STREA).\n2. Movement: primaryToken only \u2014 no secondary. Pick from **Cand_Move**.\n3. Actions: primaryToken from **Cand_Act** + secondaryToken = noun from **Items** or **Cand_Obj**.\n4. Priority: (1) TAKE room items you do not carry. (2) Prefer **Cand_Move** entries that **Hist** shows as (OK) or untried; avoid repeating (No path)/(Reject). (3) Indoors, OUT/BUILD/LEAVE before raw compass until terrain opens up.\n\n**Constraints:**\n- Do not put THEM, IT, or UP in secondary.\n- Do not use two travel primaries (invalid: WEST + UP).\n- Do not use placeholder secondaries.\n- **Wrong:** {\"primaryToken\":\"NORTH\",\"secondaryToken\":\"NORTH\"}\n- **Right:** {\"primaryToken\":\"NORTH\"}";
/** Appended to compact MLX **system** when {@link mlxAutoplaySystemPromptForVariant} gets `lootFunnelActive`. */
export declare const ADVENTURE_NL_AUTOPLAY_LOOT_FUNNEL_SYSTEM_SLM = "**Loot gate (this turn):** **Items** lists ground objects you are not yet carrying. You MUST output {\"primaryToken\":\"TAKE\",\"secondaryToken\":\"<item>\"} (or GET, same shape) for one of those objects. Do not emit travel-only JSON until **Items** is (none visible). **Cand_Move** is hidden \u2014 use **Cand_Act**/**Cand_Obj** only.";
/** Autoplay: role for the planner + session-memory context (same rules as interpret). */
export declare const ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE = "You are playing Colossal Cave Adventure as the adventurer. Choose the next parser command to continue. Reply ONLY with JSON; the exact key list is specified again at the end of the full prompt after this context.";
export declare const ADVENTURE_NL_AUTOPLAY_PLANNER_ROLE_COMPACT = "You are the adventurer. Choose the next parser command. Reply ONLY with JSON; keys are repeated at the end of the prompt.";
/** `explore` — shorter prompts, exploration-first default; `full` — legacy richer guidance. */
export type AutoplayPromptMode = "explore" | "full";
/**
 * `ADVENTURE_NL_AUTOPLAY_PROMPT_MODE=explore` (default) or `full`.
 * Explore mode prioritizes visiting new rooms and varying commands; full preserves longer loot/indoor hints.
 */
export declare function resolveAutoplayPromptMode(): AutoplayPromptMode;
/**
 * Core task + JSON contract for autoplay (embedded in {@link mlxAutoplaySystemPrompt}).
 */
export declare function mlxAutoplayPlannerInstructionsBlock(compact: boolean, mode?: AutoplayPromptMode): string;
/** Experiment knobs for Gemma-2B (and other MLX) system prompt length/structure. */
export declare const MLX_SYSTEM_PROMPT_VARIANTS: readonly ["full", "compact", "core", "bare"];
export type MlxSystemPromptVariant = (typeof MLX_SYSTEM_PROMPT_VARIANTS)[number];
/**
 * Selects system prompt shape for MLX autoplay.
 * Set `ADVENTURE_NL_MLX_SYSTEM_VARIANT` to `full` | `compact` | `core` | `bare` (default `full`).
 */
export declare function resolveMlxSystemPromptVariant(): MlxSystemPromptVariant;
/**
 * System prompt for MLX autoplay (and merged single-string prompts). Variant controls length/structure
 * for experiments with small models (see {@link resolveMlxSystemPromptVariant}).
 * The user message carries **Location**, **Exits**, **History**, **CANDIDATES**, and related fields — not a full game transcript.
 */
export declare function mlxAutoplaySystemPromptForVariant(compact: boolean, variant: MlxSystemPromptVariant, mode?: AutoplayPromptMode, lootFunnelActive?: boolean): string;
export declare function mlxAutoplaySystemPrompt(compact: boolean, mode?: AutoplayPromptMode, lootFunnelActive?: boolean): string;
/**
 * Appends a single comma-separated vocabulary line for MLX/split planner **system** prompts
 * (keeps token gloss out of the user turn).
 */
export declare function appendFlatVocabularyToPlannerSystem(systemBase: string, vocabularyFlat: string | undefined): string;
/** Same caps as embedded recent-game text in {@link buildInterpretSystemAndUserPrompt}. */
export declare function recentGameCharsCapForInterpret(compact: boolean): number;
/**
 * Tail slice of `recentGameText` actually embedded in the interpret prompt (for cache keys).
 * Must match the `recentSlice` logic in {@link buildInterpretSystemAndUserPrompt}.
 */
export declare function recentGameTextSliceForInterpretPrompt(recentGameText: string | undefined, compact: boolean): string;
/**
 * When unset: compact prompts default **on** for MLX only (smaller local models).
 * Set `ADVENTURE_NL_COMPACT_PROMPTS=0` to use full prompts on MLX, or `=1` to force compact on any provider.
 */
export declare function resolveCompactPrompts(providerId: TextLlmProviderId): boolean;
/**
 * Markdown `###` dashboard sections (state first, then task) for small local models.
 * Default **on** for MLX only. Set `ADVENTURE_NL_STRUCTURED_PROMPTS=0` to disable on MLX.
 */
export declare function resolveStructuredDashboardPrompts(providerId: TextLlmProviderId): boolean;
/** Single TASK block for structured autoplay (JSON planner). */
export declare function autoplayPlannerTaskBlockStructured(mode?: AutoplayPromptMode): string;
/** Single TASK block for structured NL interpret. */
export declare function interpretTaskBlockStructured(): string;
/**
 * Vocabulary word count embedded in NL / autoplay prompts.
 * Override with `ADVENTURE_NL_VOCAB_HINT_MAX` (8–500).
 * When `compact` is true and env is unset, uses fewer words (48 vs 120).
 */
export declare function resolveVocabHintMaxWords(compact: boolean): number;
/** Footer for interpret prompts (appended after user line + rules). */
export declare function adventureLlmInterpretJsonFooter(): string;
/** Footer for autoplay full prompt (after help + planner user body from memory). */
export declare function adventureLlmAutoplayJsonFooter(): string;
/**
 * Opening section for autoplay planner **context** (vocabulary + shared rules).
 * Caller appends derived state, turn log, raw transcript, then the global prompt
 * builder adds HELP + this body + {@link adventureLlmAutoplayJsonFooter}.
 */
export declare function linesForAutoplayPlannerContextBody(vocabSectionText: string, options?: {
    compact?: boolean;
    structuredDashboard?: boolean;
    autoplayPromptMode?: AutoplayPromptMode;
}): string[];
export declare function buildInterpretSystemAndUserPrompt(db: AdventureDatabase, userText: string, recentGameText: string | undefined, options?: BuildInterpretPromptOptions): string;
/**
 * Prepends optional HELP from adventure.dat to the system side only (Gemma: instructions first).
 */
export declare function buildAutoplayPlannerPromptParts(db: AdventureDatabase, parts: {
    system: string;
    user: string;
}, options?: AutoplayPlannerBuildOptions): {
    system: string;
    user: string;
};
/**
 * Full planner string for providers that take a single blob (Google, HTTP).
 * For `{ system, user }`, concatenates without appending {@link adventureLlmAutoplayJsonFooter}
 * (the split system block already defines JSON keys).
 */
export declare function buildAutoplayPlannerPrompt(db: AdventureDatabase, plannerUserPrompt: PlannerUserPromptInput, options?: AutoplayPlannerBuildOptions): string;
/**
 * Same strings the provider will send (after HELP merge and JSON footer for merged blob).
 * Used by the web dashboard SSE and logs.
 */
export declare function effectivePlannerSendPayload(db: AdventureDatabase, providerId: TextLlmProviderId, plannerUserPrompt: PlannerUserPromptInput, options: {
    compact: boolean;
    /** MLX + dashboard structured split: system/user to worker separately. */
    structuredSplit: boolean;
    includeDatHelpInSystem: boolean;
    /** When true, cap `fullSystem` / `fullUser` / `merged` for SSE payloads. */
    capForEventStream?: boolean;
}): {
    fullSystem?: string;
    fullUser?: string;
    merged: string;
    userPreview: string;
    systemPreview?: string;
};
//# sourceMappingURL=adventureNlPrompts.d.ts.map