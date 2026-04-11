import type { AdventureDatabase } from "./dat/types.js";
import { type AutoplayPlannerResponse } from "./schema.js";
import { type InferredExplorationMapSnapshot } from "./inferredExplorationMap.js";
export type AutoplayTurnRecord = {
    command: string;
    outcomeExcerpt: string;
    /**
     * Location fingerprint from full game output (canonical YOU ARE / YOU'RE line when present).
     * Used for stagnation and oscillation detection so order and prefixes in one-line excerpts do not dominate.
     */
    outcomeLocationFingerprint: string;
    /** True when the game output matches known parser/word-rejection lines (see adventure.dat RTEXT). */
    outcomeWasParserRejection: boolean;
    /**
     * True when full output looks like Fortran take/drop success (often SPEAK(54): a standalone "OK" line).
     * Used to infer inventory when the transcript has no "YOU ARE CARRYING" block.
     */
    outcomeHadFortranOk: boolean;
};
/** One row in the autoplay turn log for dashboards. */
export type AutoplayUiTurnSnapshot = {
    readonly command: string;
    readonly outcomeExcerpt: string;
    readonly outcomeWasParserRejection: boolean;
};
/** Heuristic session state for web UI / telemetry (Fortran text remains authoritative). */
export type AutoplayUiSnapshot = {
    readonly locationHint: string;
    readonly inventory: readonly string[];
    readonly objectNotes: readonly string[];
    readonly map: InferredExplorationMapSnapshot;
    /** Pre-rendered session FSM (Mermaid source; self-loops = no progress). */
    readonly mapMermaid: string;
    /** Graphviz DOT for the same graph (optional copy/export). */
    readonly mapDot: string;
    /** Normalized GETIN keys that were NULL at the current node (no fp/inventory change). */
    readonly nullCommandKeysAtCurrentNode: readonly string[];
    readonly stagnating: boolean;
    readonly recentTurns: readonly AutoplayUiTurnSnapshot[];
    readonly tryNextLine: string;
};
/**
 * Detect Colossal Cave-style parser rejections from full game output (case-insensitive).
 * Used so autoplay can tell the planner not to repeat the same token.
 */
export declare function gameOutputLooksLikeParserRejection(text: string): boolean;
/** True when movement in a compass direction was refused (room unchanged). */
export declare function gameOutputLooksLikeBlockedMove(text: string): boolean;
/**
 * True when the engine is asking whether to restart after death (e.g. LTEXT 81: PLAY AGAIN?).
 * The stock YES() routine treats any GETIN primary other than N / NO as affirmative.
 */
export declare function gameOutputLooksLikePlayAgainPrompt(text: string): boolean;
/**
 * Canonical 10-character GETIN key (two five-letter columns, space-padded) for comparing lines.
 */
export declare function normalizeGetinLineKey(line: string): string;
export type AlternatingLocationLoopInfo = {
    /** First five letters of GETIN primary repeated on each of the last four successful moves. */
    repeatedPrimary: string;
    locA: string;
    locB: string;
};
/**
 * Detect A→B→A→B movement: same command, alternating location lines, parser accepted each time.
 * Typical cause: bidirectional travel (e.g. ROAD) with a small model that keeps re-picking the same verb.
 */
export declare function detectAlternatingLocationCommandLoop(turns: readonly AutoplayTurnRecord[]): AlternatingLocationLoopInfo | null;
/**
 * Latest contiguous room-description block (YOU ARE / YOU'RE header + wrapped lines), or "".
 * Used to scope **Items** / object **Cand** to the **current** room so stale GRATE/WATER in the
 * tail does not hijack loot / vertical cues after the player moves.
 */
export declare function extractLatestRoomDescriptionBlock(text: string): string;
export declare class AutoplaySessionMemory {
    private recentRawTail;
    private turns;
    /**
     * Only turns from this index onward contribute to {@link inferCarriedInventoryFromTurnHistory}.
     * Advanced when Fortran prints INIT DONE (full game re-init after restart).
     */
    private inventoryTurnStart;
    /** Structured inventory lines parsed from the transcript (Fortran text is authoritative). */
    private inventory;
    private locationHint;
    private objectNotes;
    /** FIFO of GETIN keys the parser rejected; cleared after any non-rejection outcome. */
    private rejectedGetinQueue;
    private readonly exploration;
    /** Set when {@link recordCommandOutcome} or {@link seedOpening} receives `adventureDb`. */
    private adventureDbRef;
    /** graphNodeId → GETIN keys that were NULL (no location or inventory change). */
    private readonly nullCommandKeysByNode;
    /**
     * Per inferred-map node: ATAB object words where TAKE/GET + object did not succeed (parser/game
     * refusal). Excluded from **Items** / Cand_Obj until the player leaves this cell.
     */
    private readonly takeFailedObjectAtabByNodeId;
    /** ATAB object words from parsed inventory — subtract from room “takeable” on the map. */
    private inventoryObjectAtabWordsForMap;
    private mapSnapshotOptions;
    private recordTakeGetOutcomeLearning;
    /**
     * Raw accumulated transcript tail (for situational candidate extraction).
     * After each {@link recordCommandOutcome}, a line `> VERB` or `> VERB OBJECT` is
     * inserted immediately before that turn's engine output.
     */
    getRecentRawTail(): string;
    /**
     * Text slice used for **Items**, loot funnel, Cand_Obj, and vertical-passage cues: the latest
     * room-description block when one can be parsed, else the full stripped tail (same as before).
     */
    getObjectHintScopeText(): string;
    /**
     * Object-class tokens to omit from room “takeable” hints after failed TAKE/GET in this cell
     * (e.g. GRATE as scenery).
     */
    getRoomTakeFailureObjectAtabWords(): string[];
    /** Seed from transcript before the first `> ` command. */
    seedOpening(transcript: string, options?: {
        readonly adventureDb?: AdventureDatabase;
    }): void;
    /**
     * Prefix text for interactive NL interpret prompts: heuristic state, short turn log,
     * situational parser-token candidates (parity with autoplay cues). Prepended to raw
     * game output by the CLI; capped so {@link recentGameTextSliceForInterpretPrompt} keeps latest game text.
     */
    /**
     * Inventory items inferred from recent transcript: "YOU ARE CARRYING" blocks when present,
     * otherwise replay of successful TAKE/GET/DROP turns that produced Fortran "OK".
     */
    getStructuredInventory(): readonly string[];
    /** Heuristic location line parsed from recent transcript (may be empty). */
    getLocationHint(): string;
    /**
     * Snapshot of heuristic state for dashboards: inferred map, inventory hints, recent moves.
     */
    buildAutoplayUiSnapshot(): AutoplayUiSnapshot;
    /** True when the last few successful turns did not change location (see {@link STAGNATION_MIN_SAME_TURNS}). */
    isLocationStagnating(): boolean;
    /** One line for situational CANDIDATES when stagnating (inferred map). */
    formatExplorationTryNextLine(): string;
    private getNullKeysForCurrentNode;
    private addNullCommandForNode;
    buildInteractiveInterpretPrefix(db: AdventureDatabase, options: {
        readonly compact: boolean;
    }): string;
    /**
     * Record the GETIN line that was sent and the game output that followed.
     * Pass `adventureDb` so the exploration graph can show visible object counts per room.
     */
    recordCommandOutcome(command: string, gameOutput: string, options?: {
        readonly adventureDb?: AdventureDatabase;
    }): void;
    /**
     * If the planner's GETIN line matches a recently parser-rejected line, substitute a safe
     * one-word command not in the rejection queue (deterministic escape hatch).
     */
    avoidRepeatingRejectedCommand(plan: AutoplayPlannerResponse): AutoplayPlannerResponse;
    /**
     * When TAKE/GET targets an object already in parsed inventory, substitute an escape motion.
     */
    avoidRedundantTakeWhenCarrying(plan: AutoplayPlannerResponse): AutoplayPlannerResponse;
    /**
     * When the last four successful moves alternate between two rooms using the same primary
     * token, substitute **LOOK** so autoplay does not ping-pong forever (parser accepts the command).
     */
    avoidOscillatingCommand(plan: AutoplayPlannerResponse): AutoplayPlannerResponse;
    /**
     * When the location has not changed for several turns, avoid repeating the same GETIN line
     * or a motion primary already marked no-progress from this inferred cell.
     */
    avoidStagnatingCommand(plan: AutoplayPlannerResponse): AutoplayPlannerResponse;
    /**
     * After LOOK or EXAMI once left us in the same inferred room, do not send it again from this
     * cell (runs after other guards so oscillation-forced LOOK is also subject to this rule).
     */
    avoidRepeatedLookExamiInSameCell(plan: AutoplayPlannerResponse): AutoplayPlannerResponse;
    private refreshDerived;
    private buildStateBlock;
    /**
     * Structured dashboard for small MLX models: state first (Fortran output is source of truth).
     */
    private buildAdventureStateBlock;
    private buildRoomDescriptionSnippet;
    private buildItemsHereLine;
    private buildPlannerExitsLine;
    private buildPlannerBreadcrumbLine;
    private buildPlannerHistoryLine;
    /** Recent primaries with compact outcome tags for SLM **Hist:** (ties to **Cand** selection). */
    private buildPlannerHistoryCommaPrimaries;
    /** Shorter **Exits:** line: open directions comma-separated, optional tried suffix. */
    private buildPlannerExitsCommaList;
    private lastTwoBreadcrumbFingerprintsIdentical;
    /** Same primary repeated at least `min` times in the last up-to-five turns. */
    private repeatedPrimaryStreakMin;
    private buildPlannerMxTaskLine;
    /**
     * Compact situation fields for MLX structured **user** prompts (no x,y,z map, no DOT).
     */
    private buildPlannerMxUserCoreBlock;
    private buildCompactPlannerAlerts;
    private buildRecentCommandsSummary;
    /**
     * When the last GETIN result was a parser rejection, instruct the planner explicitly.
     * Small models often repeat the same primaryToken unless this is surfaced as state.
     */
    private buildParserRejectionBlock;
    private buildOscillationBlock;
    private buildStagnationBlock;
    /**
     * Session-learned travel edges from the current inferred cell to adjacent cells (labels capped).
     */
    private buildNeighborLookaheadLines;
    /** Local affordances for the current inferred cell (explore-first prompts). */
    private buildCurrentNodeBlockMx;
    /**
     * Text-only spatial hint for merged planner prompts (replaces Graphviz DOT for SLMs).
     */
    private buildPlannerSpatialHintBlock;
    private buildRejectedCommandsBlock;
    /**
     * Gemma-oriented planner: **system** = SLM **Rules** + JSON shape (no duplicate token list).
     * **user** = **Loc** / **Cand** / **Hist** / … + **Task**; tokens live only in **Cand** (situational list).
     * The worker merges `system` + `user` before generation (`scripts/mlx_lm_worker.py`).
     */
    buildPlannerMxStructuredPrompt(maxChars: number, options: {
        compact: boolean;
        situationalSection?: string;
        /** SLM loot funnel: empty inventory + visible ground objects (defers travel in Cand/Exits). */
        lootFunnel?: boolean;
    }): {
        system: string;
        user: string;
    };
    /**
     * Assemble full user prompt body for the planner: narrative sections + text spatial hint,
     * trimmed to `maxChars` (no full verbatim transcript; no numbered recent-move list).
     */
    buildPlannerUserPrompt(maxChars: number, vocabHint: string, options?: {
        compact?: boolean;
        situationalSection?: string;
        structuredDashboard?: boolean;
    }): string;
}
//# sourceMappingURL=autoplaySessionMemory.d.ts.map