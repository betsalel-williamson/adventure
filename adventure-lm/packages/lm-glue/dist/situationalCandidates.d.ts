import type { AdventureDatabase } from "./dat/types.js";
/**
 * True when recent Fortran text indicates the player is in an enclosed building
 * (compass-only travel often fails until they exit).
 */
export declare function recentTextSuggestsIndoorBuildingNavigation(text: string): boolean;
/**
 * True when recent room text suggests UP/DOWN travel (grates, pits, stairs, ladders, chasms);
 * used to surface vertical motion in Cand_Move without extra prose.
 */
export declare function recentTextSuggestsVerticalPassageNavigation(text: string): boolean;
/** Backward-compatible alias of {@link recentTextSuggestsVerticalPassageNavigation}. */
export declare function recentTextSuggestsGrateDescentNavigation(text: string): boolean;
/**
 * Drops lines that look like injected GETIN echoes (`> EAST`, `> TAKE KEYS`) so object-class
 * hints are not polluted by command text in the transcript tail.
 */
export declare function stripInjectedCommandLinesForObjectHints(text: string): string;
/**
 * Lists distinct adventure.dat object-class vocabulary words that appear in `text`
 * (same token matching as {@link buildSituationalCandidateTokens}).
 */
export declare function listVisibleAdventureObjectsInText(db: AdventureDatabase, text: string): string[];
/**
 * Counts distinct adventure.dat object-class vocabulary words that appear in `text`
 * (same token matching as {@link buildSituationalCandidateTokens}).
 */
export declare function countVisibleAdventureObjectsInText(db: AdventureDatabase, text: string): number;
/**
 * Maps a GETIN secondary (or player word) to the canonical ATAB object word from adventure.dat.
 */
export declare function matchSecondaryToObjectAtabWord(secondary: string, db: AdventureDatabase): string | undefined;
/**
 * Object-class ATAB words that appear in recent room text but are not already matched as
 * carried in `structuredInventoryLines` (same matching as {@link buildSituationalCandidateTokens}
 * `inventorySubtractText`). Use for the loot gate: **Room.Items − Inv.Items**.
 */
export declare function listVisibleRoomObjectsNotCarried(db: AdventureDatabase, recentGameText: string, structuredInventoryLines: readonly string[], 
/** ATAB object words: TAKE/GET already failed for these in the current room (session-learned). */
takeFailureAtabWords?: readonly string[]): string[];
/**
 * True when at least one adventure.dat object word appears in recent room text but not in
 * parsed inventory — SLM planner should funnel to TAKE/GET before travel.
 */
export declare function shouldPrioritizeLootFunnel(db: AdventureDatabase, recentGameText: string, structuredInventoryLines: readonly string[], takeFailureAtabWords?: readonly string[]): boolean;
export declare function buildSituationalCandidateTokens(db: AdventureDatabase, recentGameText: string, options?: {
    maxTotal?: number;
    deprioritize?: readonly string[];
    /** Pull OUT/BUILD/… to the front and push compass to the back of the motion slice. */
    indoorLeaveBuilding?: boolean;
    /**
     * Motion and travel before TAKE/object nouns — exploration-first ordering (see autoplay prompt mode).
     * Forced off when {@link lootFunnel} is true.
     */
    exploreFirst?: boolean;
    /**
     * When set, object-class words already matched in this text (e.g. parsed inventory) are omitted
     * from the object slice so KEYS is not listed as “room” when you only carry it.
     */
    inventorySubtractText?: string;
    /**
     * Omit these ATAB object words from the object slice (e.g. TAKE/GET already failed this session
     * in the current room — fixed scenery like GRATE).
     */
    takeFailureSubtractWords?: readonly string[];
    /**
     * SLM loot funnel: when {@link shouldPrioritizeLootFunnel} holds (room object words not yet carried),
     * omit travel **Cand_Move** tokens from the list (except LOOK/EXAMI are re-added via verb/defer paths).
     */
    lootFunnel?: boolean;
    /**
     * When non-empty after trim, object matching, vertical-passage heuristics, and visible-object
     * counts use this slice instead of `recentGameText` (e.g. latest room block only). Stale nouns
     * from earlier rooms in the tail are ignored.
     */
    objectHintScopeText?: string;
}): string[];
export type FormatSituationalCandidatesOptions = {
    /**
     * When true, emit a single comma-separated token line (for SLMs — avoids long per-token gloss).
     * Ignored when {@link slmGrouped} is true.
     * @default false
     */
    flatList?: boolean;
    /**
     * When true, emit **Cand_Move:** / **Cand_Act:** / **Cand_Obj:** (function buckets for SLMs).
     * @default false
     */
    slmGrouped?: boolean;
    /**
     * When true with {@link slmGrouped}, empty **Cand_Move** shows a deferred message instead of "(none)".
     */
    lootFunnelDeferCandMove?: boolean;
};
export declare function formatSituationalCandidatesSection(db: AdventureDatabase, candidates: readonly string[], appendix?: string, options?: FormatSituationalCandidatesOptions): string;
/**
 * Step 1 of optional two-step autoplay (MLX): model picks a subset of allowed tokens.
 */
export declare function buildAutoplayRelevantTokensFilterPrompt(recentGameText: string, allowedTokens: readonly string[]): string;
/** Parse step-1 JSON; only returns tokens present in `allowed` (trimmed five-char style). */
export declare function parseRelevantTokensResponse(raw: unknown, allowed: ReadonlySet<string>): string[];
//# sourceMappingURL=situationalCandidates.d.ts.map