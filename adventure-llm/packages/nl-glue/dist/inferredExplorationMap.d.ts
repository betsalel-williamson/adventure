/**
 * Wrapper-only inferred map: the Fortran engine does not expose coordinates.
 * Convention: +x = EAST, +y = NORTH, +z = UP (documented here; arbitrary but stable).
 */
import type { AdventureDatabase } from "./dat/types.js";
export type Vec3 = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};
export type ExitOutcomeKind = "reject" | "same" | "moved";
/** Directed FSM edge for visualization (session-learned, not engine truth). */
export type DirectedEdgeKind = "move" | "self" | "reject" | "action";
export type DirectedEdgeSnapshot = {
    readonly from: string;
    readonly to: string;
    /** Display label (see {@link graphEdgeLabelFromCommand}). */
    readonly label: string;
    readonly kind: DirectedEdgeKind;
};
export type TriedCommandSnapshot = {
    readonly lineKey: string;
    /** Same string as {@link DirectedEdgeSnapshot.label} for this command. */
    readonly label: string;
    readonly kind: DirectedEdgeKind;
};
export type LocalActionKind = "reject" | "self" | "apply";
export type LocalActionSnapshot = {
    readonly lineKey: string;
    readonly label: string;
    readonly kind: LocalActionKind;
};
/**
 * Mermaid-safe id for a cell key `x,y,z` (3D embedding node id).
 * Negative components use `m` prefix (e.g. -1 → m1).
 */
export declare function graphNodeIdFromCellKey(cellKey: string): string;
/** Same normalization as autoplay session (one line, capped) for room identity. */
export declare function fingerprintLocationFromExcerpt(excerpt: string): string;
/**
 * Merges known-equivalent Colossal Cave location strings for session map identity.
 * Safe no-op for other fingerprints.
 */
export declare function canonicalExplorationFingerprint(fp: string): string;
/**
 * Prefer the first **place** line starting with YOU ARE / YOU'RE (skips inventory lines).
 * Leading warnings (e.g. blocked move) before the room line are ignored.
 */
export declare function extractLocationLineForFingerprint(text: string): string | null;
/** Fingerprint from canonical location line when present; otherwise from full text. */
export declare function fingerprintLocationFromGameOutput(text: string): string;
/**
 * Room identity from game output only when a **place** line exists.
 * Returns null for notification-only text, OK-only, or inventory-only lines — caller should keep prior room.
 */
export declare function locationFingerprintFromGameOutputStrict(text: string): string | null;
/**
 * Fingerprint for session map and turn logs: canonical YOU ARE/YOU'RE line first, then any
 * {@link hasPlaceLikeProse} blob (rooms that omit YOU ARE), then the previous room when the
 * output is e.g. OK-only or otherwise not place-like.
 */
export declare function sessionLocationFingerprintFromGameOutput(text: string, previousFingerprint: string | null): string;
export declare function isNonLocationObjectPrimary(primary: string): boolean;
export declare function vecKey(v: Vec3): string;
/** Heuristic room category from the location fingerprint (for UI legend / styling). */
export type InferredRoomKind = "road" | "building" | "forest" | "valley" | "cave" | "maze" | "grate" | "hall" | "water" | "other";
/**
 * Classify a normalized location fingerprint into a coarse room kind and short label for tooltips.
 * Order of checks matters (e.g. road-before-building for "end of a road … building").
 */
export declare function classifyRoomFingerprint(fingerprint: string): {
    readonly roomKind: InferredRoomKind;
    /** Truncated fingerprint text for display / title attributes. */
    readonly label: string;
};
export declare function isMazeFingerprint(fingerprint: string): boolean;
export declare function inverseMotionPrimary(primary: string): string | undefined;
export declare function isGridMotionPrimary(primary: string): boolean;
export declare function travelMotionPrimaryIgnoresSecondColumn(primary: string): boolean;
/** One discovered room in the wrapper grid (fingerprint → heuristic coordinates). */
export type InferredExplorationCellSnapshot = {
    readonly graphNodeId: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly fingerprint: string;
    readonly roomKind: InferredRoomKind;
    readonly label: string;
    /**
     * Object-class ATAB words believed on the ground in this cell (from room text and
     * take/drop updates). `null` if never estimated.
     */
    readonly groundObjectWords: readonly string[] | null;
    /**
     * Objects still takeable here (ground minus parsed inventory). `null` when {@link groundObjectWords} is null.
     */
    readonly takeableObjectWords: readonly string[] | null;
    /**
     * Convenience: number still takeable; `null` when ground state is unknown.
     */
    readonly visibleObjectCount: number | null;
};
/** Serializable inferred map for dashboards / telemetry. */
export type InferredExplorationMapSnapshot = {
    readonly current: Vec3;
    readonly currentGraphNodeId: string;
    readonly lastFingerprint: string | null;
    readonly cells: readonly InferredExplorationCellSnapshot[];
    /** cellKey (`x,y,z`) → tried exits and outcomes */
    readonly exitOutcomes: Readonly<Record<string, ReadonlyArray<{
        readonly primary: string;
        readonly outcome: ExitOutcomeKind;
    }>>>;
    /**
     * Session-learned FSM edges: `move`/`self`/`reject` = travel; `action` = non-move commands
     * (TAKE, LOOK, …) as self-loops at that node (see {@link DirectedEdgeKind}).
     */
    readonly directedEdges: readonly DirectedEdgeSnapshot[];
    /** nodeId → commands tried from that node (capped). */
    readonly triedCommandsByNode: Readonly<Record<string, readonly TriedCommandSnapshot[]>>;
    /** Same non-move actions as `action` edges in {@link directedEdges}, structured per node. */
    readonly nonLocationActionsByNode: Readonly<Record<string, readonly LocalActionSnapshot[]>>;
};
/**
 * Grid deltas for motion primaries (five-letter ATAB forms).
 * Non-listed motion (ROAD, BUILD, ENTER, …) uses teleport placement when the room changes.
 *
 * **IN / OUT:** Heuristic for Colossal Cave–style moves (e.g. grate depression → IN → chamber
 * beneath); maps “into” the enclosed space as **dz −1** and **OUT** as **dz +1** so the
 * inferred map tracks depth. This is not engine truth.
 */
export declare const MOTION_GRID_DELTA: Readonly<Record<string, {
    dx: number;
    dy: number;
    dz: number;
}>>;
/**
 * Longest motion primary name for each grid delta so `N` and `NORTH` dedupe as one command.
 * Non-motion primaries are returned unchanged.
 */
export declare function canonicalMotionPrimaryForDedup(primary: string): string;
/** Base cardinal order (E/W before N/S); rotated per cell by {@link orderedEscapePrimariesForCellKey}. */
export declare const CARDINAL_ESCAPE_PRIMARIES: readonly string[];
/**
 * Full escape list: cardinals first (same base order as situationalCandidates motion slice),
 * then diagonals (when enabled) and other motion. Respects `ADVENTURE_LLM_DIAGONAL_COMPASS_MOTION`.
 */
export declare function autoplayEscapePrimaryOrder(): string[];
/**
 * Escape order when diagonal compass motion is enabled (matches historical full adventure.dat list).
 * @deprecated Prefer {@link autoplayEscapePrimaryOrder} for flag-aware behavior.
 */
export declare const AUTOPLAY_ESCAPE_PRIMARY_ORDER: readonly string[];
/**
 * Stable 0..3 rotation from inferred cell key so different grid cells try cardinals in
 * different orders (reduces always-EAST / always-NORTH wandering on the session FSM).
 */
export declare function cardinalRotationForCellKey(cellKey: string): number;
/** Rotated cardinals + non-cardinal tail (deterministic per cell). */
export declare function orderedEscapePrimariesForCellKey(cellKey: string): string[];
export declare function primaryFromGetinCommand(command: string): string;
/** Second five-letter GETIN column (trimmed). */
export declare function secondaryFromGetinCommand(command: string): string;
/**
 * Label for FSM edges and diagrams: primary plus optional secondary (e.g. `TAKE KEYS`).
 * Uses the same 10-character GETIN layout as parser lines (two five-letter columns).
 */
export declare function fsmLabelFromGetinCommand(command: string): string;
/**
 * True for compass, travel-list primaries (ROAD, ENTER, …), and false for LOOK/EXAMI and
 * noun-as-primary lines (e.g. KEYS). Used to split no-progress lists in planner prompts.
 */
export declare function isBlockedTravelOrExitPrimary(primary: string): boolean;
/**
 * True when the primary is a plausible direction, travel token, or known verb for graph labels.
 * Noun primaries (KEYS as column 1) are false so edges can be annotated.
 */
export declare function isLegitimateGraphEdgePrimary(primary: string): boolean;
/**
 * Label for session FSM edges and tried-command lists: same as {@link fsmLabelFromGetinCommand},
 * or with a short hint when column 1 is an object word (prefer TAKE/GET + object).
 */
export declare function graphEdgeLabelFromCommand(command: string): string;
/**
 * Short hint for dashboard captions: how this primary maps on the inferred grid (not engine truth).
 * Returns null when the primary has no entry in {@link MOTION_GRID_DELTA}.
 */
export declare function describeMotionGridDelta(primary: string): string | null;
export type AutoplayTurnLike = {
    outcomeExcerpt: string;
    outcomeWasParserRejection: boolean;
    /**
     * When set (from full game output), used for stagnation instead of excerpt-only fingerprint.
     */
    outcomeLocationFingerprint?: string;
};
/**
 * True when the last `minSameTurns` successful turns share the same location fingerprint.
 */
export declare function detectLocationStagnation(turns: readonly AutoplayTurnLike[], minSameTurns?: number): boolean;
export declare class InferredExplorationMap {
    private currentVec;
    private lastFingerprint;
    /** Non-maze fingerprints only — maze rooms share text and use {@link mazeEdges}. */
    private readonly landmarkFpToVec;
    /** Every discovered cell key → latest location fingerprint seen there. */
    private readonly cellKeyToFingerprint;
    /** Maze / duplicate-text rooms: directed edges for grid primaries (inverse for backtracking). */
    private readonly mazeEdges;
    /** cellKey -> primary -> last outcome from that cell */
    private readonly exitOutcomes;
    /** Session-learned directed edges for FSM visualization (capped). */
    private directedEdges;
    /** nodeId → tried commands (capped per node). */
    private readonly triedByNode;
    /** nodeId → object / non-navigation actions (capped per node). */
    private readonly localActionsByNode;
    /** cellKey → objects believed on the ground (session model; refreshed from room text when available). */
    private readonly cellKeyToGroundObjects;
    /** Dedupes FSM edges: same from→to, kind, and motion-equivalent command (e.g. N vs NORTH). */
    private readonly graphEdgeDedupKeys;
    /** Last motion primary attempted from each cell (canonical) — deprioritized in escape order. */
    private readonly lastMotionPrimaryByCell;
    private orderEscapePrimariesForCell;
    private pushGraphEdge;
    private pushLocalAction;
    seedFromTranscript(transcript: string, options?: {
        readonly adventureDb?: AdventureDatabase;
    }): void;
    getCurrentVec(): Vec3;
    getLastFingerprint(): string | null;
    getDiscoveredRoomCount(): number;
    private setOutcome;
    getExitOutcome(cellKey: string, primary: string): ExitOutcomeKind | undefined;
    currentCellKey(): string;
    /**
     * Primaries tried from the current cell with outcome `same` or `reject` (for prompts).
     */
    getDeadEndPrimariesFromCurrentCell(): string[];
    /**
     * Same-room / rejected primaries split for prompts: travel & compass vs LOOK / objects / other.
     */
    partitionDeadEndPrimariesFromCurrentCell(): {
        travel: string[];
        other: string[];
    };
    /**
     * Motion primaries worth suggesting as **fresh** tries from this cell (Try-next line).
     * Excludes `same` / `reject`, optional NULL keys, and travel/exit primaries that already
     * **moved** the player from this cell (those belong in **Known exits**, not as “try next”).
     */
    getUntriedMotionPrimaries(excludeLineKeys?: ReadonlySet<string>): string[];
    private isCellKeyOccupied;
    allocateTeleportFrom(base: Vec3): Vec3;
    private addMazeEdge;
    private applyGridOrTeleport;
    /**
     * Update map after a turn (call after appending the turn to the session log).
     * @param gameOutputForFingerprint — full game output or excerpt; location line is extracted when possible.
     * @param options.adventureDb — when set, tracks per-cell ground objects from room text and take/drop.
     * @param options.outcomeHadFortranOk — when set, take/drop secondaries adjust ground-object sets.
     */
    recordOutcome(command: string, gameOutputForFingerprint: string, outcomeWasParserRejection: boolean, outcomeWasBlockedMove?: boolean, options?: {
        readonly adventureDb?: AdventureDatabase;
        readonly outcomeHadFortranOk?: boolean;
    }): void;
    /**
     * Refresh per-cell ground objects from room text; remove on successful take, add on drop.
     */
    private applyGroundObjectModelAfterOutcome;
    formatPromptLines(options?: {
        compact?: boolean;
        /** Normalized GETIN keys (e.g. NULL / no-progress) to omit from "try next" options. */
        excludeLineKeys?: ReadonlySet<string>;
    }): string[];
    /**
     * Pick a primary token for deterministic escape; respects parser-rejected GETIN keys (primary-only).
     */
    pickEscapePrimary(rejectedLineKeys: ReadonlySet<string>, nullLineKeys?: ReadonlySet<string>): string | null;
    /** Read-only snapshot for UI / logging (wrapper heuristic, not engine truth). */
    toSnapshot(options?: {
        readonly inventoryObjectAtabWords?: ReadonlySet<string>;
    }): InferredExplorationMapSnapshot;
}
//# sourceMappingURL=inferredExplorationMap.d.ts.map