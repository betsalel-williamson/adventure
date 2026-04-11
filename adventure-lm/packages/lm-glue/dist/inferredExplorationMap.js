/**
 * Wrapper-only inferred map: the Fortran engine does not expose coordinates.
 * Convention: +x = EAST, +y = NORTH, +z = UP (documented here; arbitrary but stable).
 */
import { isDiagonalCompassMotionEnabled } from "./diagonalCompassMotion.js";
import { listVisibleAdventureObjectsInText, matchSecondaryToObjectAtabWord, } from "./situationalCandidates.js";
const MAX_GRAPH_EDGES = 2000;
const MAX_TRIED_PER_NODE = 64;
/**
 * Mermaid-safe id for a cell key `x,y,z` (3D embedding node id).
 * Negative components use `m` prefix (e.g. -1 → m1).
 */
export function graphNodeIdFromCellKey(cellKey) {
    const parts = cellKey.split(",");
    const segs = parts.map((p) => {
        const n = Number(p.trim());
        if (!Number.isFinite(n))
            return "0";
        if (n < 0)
            return `m${-n}`;
        return String(n);
    });
    return `k_${segs.join("_")}`;
}
function normalizeGetinLineKeyForMap(line) {
    const t = line.replace(/\r/g, "").toUpperCase().trim();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    const primary = head.slice(0, 5).trimEnd().padEnd(5, " ");
    const secondary = head.slice(5, 10).trimEnd().padEnd(5, " ");
    return `${primary}${secondary}`;
}
function pushTried(map, nodeId, entry) {
    let arr = map.get(nodeId);
    if (!arr) {
        arr = [];
        map.set(nodeId, arr);
    }
    const last = arr[arr.length - 1];
    if (last &&
        last.lineKey === entry.lineKey &&
        last.kind === entry.kind &&
        last.label === entry.label) {
        return;
    }
    arr.push(entry);
    if (arr.length > MAX_TRIED_PER_NODE) {
        arr.splice(0, arr.length - MAX_TRIED_PER_NODE);
    }
}
function pushLocalTried(map, nodeId, entry) {
    let arr = map.get(nodeId);
    if (!arr) {
        arr = [];
        map.set(nodeId, arr);
    }
    const last = arr[arr.length - 1];
    if (last &&
        last.lineKey === entry.lineKey &&
        last.kind === entry.kind &&
        last.label === entry.label) {
        return;
    }
    arr.push(entry);
    if (arr.length > MAX_TRIED_PER_NODE) {
        arr.splice(0, arr.length - MAX_TRIED_PER_NODE);
    }
}
/** Same normalization as autoplay session (one line, capped) for room identity. */
export function fingerprintLocationFromExcerpt(excerpt) {
    const t = excerpt.replace(/\s+/g, " ").trim().toUpperCase();
    return t.slice(0, 88);
}
/**
 * Stock Colossal Cave LTEXT 1 (road before well house) can appear with different wording or
 * line breaks (truncated before `BUILDING`, shorter YOU ARE AT…, OUT line `YOU'RE AT END OF ROAD
 * AGAIN`). Map those to one fingerprint so the inferred map does not split the same place.
 */
const CANONICAL_OUTDOOR_ROAD_START_FINGERPRINT = fingerprintLocationFromExcerpt("YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING.");
function matchesOutdoorRoadStartFingerprint(u) {
    const n = u.replace(/\s+/g, " ").trim().toUpperCase();
    if (n.includes("HILL IN ROAD") || n.includes("YOU HAVE WALKED UP A HILL")) {
        return false;
    }
    if (n.includes("YOU'RE AT END OF ROAD AGAIN") ||
        n.includes("YOU ARE AT END OF ROAD AGAIN")) {
        return true;
    }
    if (!n.includes("END OF A ROAD"))
        return false;
    if (n.includes("SMALL BRICK") ||
        n.includes("SMALL BUILDING") ||
        n.includes("BEFORE A BUILDING")) {
        return true;
    }
    if (n.includes("STANDING AT THE END OF A ROAD") ||
        n.includes("YOU ARE AT THE END OF A ROAD") ||
        n.includes("YOU'RE AT THE END OF A ROAD")) {
        if (n.includes("HILL"))
            return false;
        return true;
    }
    return false;
}
/**
 * Merges known-equivalent Colossal Cave location strings for session map identity.
 * Safe no-op for other fingerprints.
 */
export function canonicalExplorationFingerprint(fp) {
    const t = fp.replace(/\s+/g, " ").trim();
    if (t.length === 0)
        return fp;
    if (matchesOutdoorRoadStartFingerprint(t)) {
        return CANONICAL_OUTDOOR_ROAD_START_FINGERPRINT;
    }
    return fp;
}
/**
 * True for YOU ARE / YOU'RE lines that describe inventory or meta state, not place.
 * Skipped so carrying lines do not overwrite room identity.
 */
function isNonRoomLocationLine(segment) {
    const u = segment.toUpperCase();
    if (u.includes("YOU ARE CARRYING"))
        return true;
    if (u.includes("YOU ARE ALREADY CARRYING"))
        return true;
    if (u.includes("YOU'RE ALREADY CARRYING"))
        return true;
    if (u.includes("ALREADY CARRYING"))
        return true;
    if (u.includes("YOU AREN'T CARRYING") || u.includes("YOU ARENT CARRYING"))
        return true;
    if (u.includes("YOU ARE NOT CARRYING"))
        return true;
    if (u.includes("YOU ARE EMPTY"))
        return true;
    if (u.includes("YOU'RE EMPTY"))
        return true;
    if (u.includes("YOU ARE HOLDING"))
        return true;
    return false;
}
/**
 * True when free text plausibly describes a place (not only OK / inventory / parser noise).
 * Used when {@link extractLocationLineForFingerprint} finds no dotted YOU ARE/YOU'RE sentence.
 */
function hasPlaceLikeProse(text) {
    const u = text.toUpperCase();
    return (u.includes("YOU ARE IN ") ||
        u.includes("YOU ARE INSIDE") ||
        u.includes("YOU ARE STANDING") ||
        u.includes("YOU ARE ON ") ||
        u.includes("YOU ARE AT ") ||
        u.includes("YOU'RE INSIDE") ||
        u.includes("YOU'RE AT ") ||
        u.includes("END OF A ROAD") ||
        u.includes("MAZE OF TWISTY") ||
        u.includes("YOU ARE IN A MAZE") ||
        u.includes("WELL HOUSE") ||
        u.includes("STEEL GRATE") ||
        (u.includes("YOU ARE IN") && u.includes("BUILDING")) ||
        (u.includes("YOU ARE") && u.includes("FOREST")) ||
        (u.includes("YOU ARE") && u.includes("VALLEY")) ||
        (u.includes("YOU ARE") && u.includes("CAVE")) ||
        /** Stock Colossal Cave LTEXT without a YOU ARE line (stream slit, mist pit, …). */
        u.includes("AT YOUR FEET") ||
        u.includes("THIS IS A LOW ROOM"));
}
/**
 * Prefer the first **place** line starting with YOU ARE / YOU'RE (skips inventory lines).
 * Leading warnings (e.g. blocked move) before the room line are ignored.
 */
export function extractLocationLineForFingerprint(text) {
    const oneLine = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    if (oneLine.length === 0)
        return null;
    let searchFrom = 0;
    while (searchFrom < oneLine.length) {
        const slice = oneLine.slice(searchFrom);
        const upper = slice.toUpperCase();
        const youAre = upper.indexOf("YOU ARE ");
        const youre = upper.indexOf("YOU'RE ");
        let rel = -1;
        if (youAre >= 0 && (youre < 0 || youAre <= youre))
            rel = youAre;
        else if (youre >= 0)
            rel = youre;
        if (rel < 0)
            return null;
        const start = searchFrom + rel;
        const rest = oneLine.slice(start);
        const dotIdx = rest.indexOf(".");
        const segment = dotIdx >= 0 ? rest.slice(0, dotIdx + 1) : rest;
        const trimmed = segment.trim();
        if (isNonRoomLocationLine(trimmed)) {
            searchFrom = start + 1;
            continue;
        }
        return trimmed;
    }
    return null;
}
/** Fingerprint from canonical location line when present; otherwise from full text. */
export function fingerprintLocationFromGameOutput(text) {
    const line = extractLocationLineForFingerprint(text);
    if (line !== null && line.length > 0) {
        return fingerprintLocationFromExcerpt(line);
    }
    const collapsed = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    if (collapsed.length === 0)
        return fingerprintLocationFromExcerpt("");
    const u = collapsed.toUpperCase();
    if (u === "OK" || u === "OK.")
        return fingerprintLocationFromExcerpt("");
    if (hasPlaceLikeProse(text)) {
        return fingerprintLocationFromExcerpt(text);
    }
    return fingerprintLocationFromExcerpt("");
}
/**
 * Room identity from game output only when a **place** line exists.
 * Returns null for notification-only text, OK-only, or inventory-only lines — caller should keep prior room.
 */
export function locationFingerprintFromGameOutputStrict(text) {
    const line = extractLocationLineForFingerprint(text);
    if (line === null || line.length === 0)
        return null;
    return fingerprintLocationFromExcerpt(line);
}
/**
 * Fingerprint for session map and turn logs: canonical YOU ARE/YOU'RE line first, then any
 * {@link hasPlaceLikeProse} blob (rooms that omit YOU ARE), then the previous room when the
 * output is e.g. OK-only or otherwise not place-like.
 */
export function sessionLocationFingerprintFromGameOutput(text, previousFingerprint) {
    const prevCanon = previousFingerprint !== null && previousFingerprint.length > 0
        ? canonicalExplorationFingerprint(previousFingerprint)
        : null;
    const strict = locationFingerprintFromGameOutputStrict(text);
    if (strict !== null)
        return canonicalExplorationFingerprint(strict);
    const loose = fingerprintLocationFromGameOutput(text);
    if (loose.length > 0)
        return canonicalExplorationFingerprint(loose);
    return prevCanon ?? "";
}
/** Primaries that manipulate objects / look / inventory — not drawn on the location-only graph. */
const NON_LOCATION_OBJECT_PRIMARIES = new Set([
    "TAKE",
    "GET",
    "DROP",
    "OPEN",
    "LOCK",
    "KILL",
    "FEED",
    "INVE",
    "LOOK",
    "EXAMI",
    "READ",
    "THROW",
    "WAVE",
    "RUB",
    "POUR",
    "EAT",
    "DRINK",
    "ON",
    "OFF",
]);
export function isNonLocationObjectPrimary(primary) {
    return NON_LOCATION_OBJECT_PRIMARIES.has(primary.toUpperCase().trim());
}
/** Verb primaries that pick up objects (align with autoplay inventory heuristics). */
const TAKE_VERB_PRIMARIES_FOR_ROOM = new Set([
    "TAKE",
    "GET",
    "KEEP",
    "PICKU",
    "PICK",
    "WEAR",
    "CATCH",
    "STEAL",
    "CAPTU",
    "FIND",
    "WHERE",
]);
const DROP_VERB_PRIMARIES_FOR_ROOM = new Set([
    "RELEA",
    "FREE",
    "DISCA",
    "DROP",
    "DUMP",
]);
export function vecKey(v) {
    return `${v.x},${v.y},${v.z}`;
}
function parseVecKey(key) {
    const parts = key.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        z: Number.isFinite(z) ? z : 0,
    };
}
/**
 * Classify a normalized location fingerprint into a coarse room kind and short label for tooltips.
 * Order of checks matters (e.g. road-before-building for "end of a road … building").
 */
export function classifyRoomFingerprint(fingerprint) {
    const label = fingerprint.length > 88 ? `${fingerprint.slice(0, 87)}…` : fingerprint;
    const u = fingerprint.toUpperCase();
    if (u.includes("MAZE OF TWISTY") || u.includes("ALL ALIKE")) {
        return { roomKind: "maze", label };
    }
    if (u.includes("END OF A ROAD") ||
        u.includes("STANDING AT THE END OF A ROAD")) {
        return { roomKind: "road", label };
    }
    if (u.includes("WELL HOUSE") ||
        u.includes("YOU'RE INSIDE BUILDING") ||
        (u.includes("YOU ARE INSIDE A BUILDING") && u.includes("WELL"))) {
        return { roomKind: "building", label };
    }
    if (u.includes("INSIDE A BUILDING") ||
        (u.includes("YOU ARE INSIDE") && u.includes("BUILDING"))) {
        return { roomKind: "building", label };
    }
    if (u.includes("STEEL GRATE") ||
        (u.includes("GRATE") && u.includes("DEPRESSION"))) {
        return { roomKind: "grate", label };
    }
    if (u.includes("OPEN FOREST") || u.includes("IN OPEN FOREST")) {
        return { roomKind: "forest", label };
    }
    if (u.includes("IN A VALLEY") || u.includes("BESIDE A STREAM")) {
        return { roomKind: "valley", label };
    }
    if (u.includes("VALLEY")) {
        return { roomKind: "valley", label };
    }
    if (u.includes("CAVERN") ||
        u.includes("CAVE ") ||
        u.endsWith(" CAVE") ||
        u.includes(" COLOSSAL CAVE")) {
        return { roomKind: "cave", label };
    }
    if (u.includes("VAST HALL") ||
        u.includes("HALL OF ") ||
        u.includes("HALL STRETCHING") ||
        u.includes("HALL OF MISTS")) {
        return { roomKind: "hall", label };
    }
    if (u.includes("STREAM") ||
        u.includes("GULLY") ||
        u.includes("DOWN A GULLY")) {
        return { roomKind: "water", label };
    }
    if (u.includes("FOREST")) {
        return { roomKind: "forest", label };
    }
    return { roomKind: "other", label };
}
export function isMazeFingerprint(fingerprint) {
    return classifyRoomFingerprint(fingerprint).roomKind === "maze";
}
/** Inverse pairs for grid motion primaries (five-letter ATAB forms and single-letter compass). */
const INVERSE_MOTION_PRIMARY = {
    NORTH: "SOUTH",
    SOUTH: "NORTH",
    N: "S",
    S: "N",
    EAST: "WEST",
    WEST: "EAST",
    E: "W",
    W: "E",
    NE: "SW",
    SE: "NW",
    NW: "SE",
    SW: "NE",
    UP: "DOWN",
    DOWN: "UP",
    IN: "OUT",
    OUT: "IN",
};
export function inverseMotionPrimary(primary) {
    return INVERSE_MOTION_PRIMARY[primary];
}
export function isGridMotionPrimary(primary) {
    return Object.prototype.hasOwnProperty.call(MOTION_GRID_DELTA, primary);
}
/**
 * Travel / simple motion verbs use GETIN column 1 only in this engine. A filled column 2
 * with an object word (e.g. SOUTH + BOTTL) is almost always a planner mistake and must not
 * appear as a combined FSM label or dedup key.
 */
const TELEPORT_TRAVEL_PRIMARIES_SINGLE_COLUMN = new Set([
    "ROAD",
    "BUILD",
    "LEAVE",
    "ENTER",
    "EXIT",
    "LOOK",
]);
export function travelMotionPrimaryIgnoresSecondColumn(primary) {
    const p = primary.toUpperCase().trim();
    if (isGridMotionPrimary(p))
        return true;
    return TELEPORT_TRAVEL_PRIMARIES_SINGLE_COLUMN.has(p);
}
function addVec(a, d) {
    return { x: a.x + d.dx, y: a.y + d.dy, z: a.z + d.dz };
}
/**
 * Grid deltas for motion primaries (five-letter ATAB forms).
 * Non-listed motion (ROAD, BUILD, ENTER, …) uses teleport placement when the room changes.
 *
 * **IN / OUT:** Heuristic for Colossal Cave–style moves (e.g. grate depression → IN → chamber
 * beneath); maps “into” the enclosed space as **dz −1** and **OUT** as **dz +1** so the
 * inferred map tracks depth. This is not engine truth.
 */
export const MOTION_GRID_DELTA = {
    NORTH: { dx: 0, dy: 1, dz: 0 },
    N: { dx: 0, dy: 1, dz: 0 },
    SOUTH: { dx: 0, dy: -1, dz: 0 },
    S: { dx: 0, dy: -1, dz: 0 },
    EAST: { dx: 1, dy: 0, dz: 0 },
    E: { dx: 1, dy: 0, dz: 0 },
    WEST: { dx: -1, dy: 0, dz: 0 },
    W: { dx: -1, dy: 0, dz: 0 },
    NE: { dx: 1, dy: 1, dz: 0 },
    SE: { dx: 1, dy: -1, dz: 0 },
    SW: { dx: -1, dy: -1, dz: 0 },
    NW: { dx: -1, dy: 1, dz: 0 },
    UP: { dx: 0, dy: 0, dz: 1 },
    DOWN: { dx: 0, dy: 0, dz: -1 },
    /** Enter crawl / chamber below (e.g. under grate). */
    IN: { dx: 0, dy: 0, dz: -1 },
    /** Leave back to higher level (e.g. out of crawl to surface). */
    OUT: { dx: 0, dy: 0, dz: 1 },
};
/**
 * Longest motion primary name for each grid delta so `N` and `NORTH` dedupe as one command.
 * Non-motion primaries are returned unchanged.
 */
export function canonicalMotionPrimaryForDedup(primary) {
    const u = primary.toUpperCase().trim();
    const delta = MOTION_GRID_DELTA[u];
    if (delta === undefined)
        return u;
    const key = `${delta.dx},${delta.dy},${delta.dz}`;
    let best = u;
    for (const [name, d] of Object.entries(MOTION_GRID_DELTA)) {
        if (`${d.dx},${d.dy},${d.dz}` !== key)
            continue;
        if (name.length > best.length)
            best = name;
    }
    return best;
}
function normalizeGetinLineKeyForGraphDedup(command) {
    const t = command.replace(/\r/g, "").toUpperCase().trim();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    const primaryRaw = head.slice(0, 5).trimEnd();
    const primaryCanon = canonicalMotionPrimaryForDedup(primaryRaw);
    const secondaryRaw = head.slice(5, 10).trimEnd();
    const secondary = travelMotionPrimaryIgnoresSecondColumn(primaryCanon) || secondaryRaw === ""
        ? "     "
        : secondaryRaw.padEnd(5, " ");
    return `${primaryCanon.padEnd(5, " ")}${secondary}`;
}
/** Base cardinal order (E/W before N/S); rotated per cell by {@link orderedEscapePrimariesForCellKey}. */
export const CARDINAL_ESCAPE_PRIMARIES = [
    "EAST",
    "WEST",
    "NORTH",
    "SOUTH",
];
/** Diagonal motion slice (adventure.dat); omitted unless {@link isDiagonalCompassMotionEnabled}. */
const ESCAPE_PRIMARY_DIAGONAL_BLOCK = [
    "NE",
    "SE",
    "NW",
    "SW",
];
const ESCAPE_PRIMARY_NON_CARDINAL_TAIL_REST = [
    "UP",
    "DOWN",
    "ENTER",
    "IN",
    "OUT",
    "BUILD",
    "ROAD",
    "LEAVE",
    "EXAMI",
    "LOOK",
];
function escapePrimaryNonCardinalTail() {
    if (isDiagonalCompassMotionEnabled()) {
        return [
            ...ESCAPE_PRIMARY_DIAGONAL_BLOCK,
            ...ESCAPE_PRIMARY_NON_CARDINAL_TAIL_REST,
        ];
    }
    return [...ESCAPE_PRIMARY_NON_CARDINAL_TAIL_REST];
}
/**
 * Full escape list: cardinals first (same base order as situationalCandidates motion slice),
 * then diagonals (when enabled) and other motion. Respects `ADVENTURE_LM_DIAGONAL_COMPASS_MOTION`.
 */
export function autoplayEscapePrimaryOrder() {
    return [...CARDINAL_ESCAPE_PRIMARIES, ...escapePrimaryNonCardinalTail()];
}
/**
 * Escape order when diagonal compass motion is enabled (matches historical full adventure.dat list).
 * @deprecated Prefer {@link autoplayEscapePrimaryOrder} for flag-aware behavior.
 */
export const AUTOPLAY_ESCAPE_PRIMARY_ORDER = [
    ...CARDINAL_ESCAPE_PRIMARIES,
    ...ESCAPE_PRIMARY_DIAGONAL_BLOCK,
    ...ESCAPE_PRIMARY_NON_CARDINAL_TAIL_REST,
];
/**
 * Stable 0..3 rotation from inferred cell key so different grid cells try cardinals in
 * different orders (reduces always-EAST / always-NORTH wandering on the session FSM).
 */
export function cardinalRotationForCellKey(cellKey) {
    let h = 2166136261;
    for (let i = 0; i < cellKey.length; i++) {
        h ^= cellKey.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 4;
}
/** Rotated cardinals + non-cardinal tail (deterministic per cell). */
export function orderedEscapePrimariesForCellKey(cellKey) {
    const rot = cardinalRotationForCellKey(cellKey);
    const c = CARDINAL_ESCAPE_PRIMARIES;
    const rotated = [...c.slice(rot), ...c.slice(0, rot)];
    return [...rotated, ...escapePrimaryNonCardinalTail()];
}
function deprioritizeLastPrimary(order, lastPrimary) {
    if (lastPrimary === undefined || order.length <= 1)
        return [...order];
    const u = lastPrimary.toUpperCase().trim();
    const idx = order.findIndex((p) => p === u);
    if (idx <= 0)
        return [...order];
    const out = [...order];
    const [moved] = out.splice(idx, 1);
    out.push(moved);
    return out;
}
export function primaryFromGetinCommand(command) {
    const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
    const head = (t.length >= 5 ? t.slice(0, 5) : t.padEnd(5, " ")).slice(0, 5);
    return head.trimEnd();
}
/** Second five-letter GETIN column (trimmed). */
export function secondaryFromGetinCommand(command) {
    const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    return head.slice(5, 10).trimEnd();
}
/**
 * Label for FSM edges and diagrams: primary plus optional secondary (e.g. `TAKE KEYS`).
 * Uses the same 10-character GETIN layout as parser lines (two five-letter columns).
 */
export function fsmLabelFromGetinCommand(command) {
    const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    const primary = head.slice(0, 5).trimEnd();
    const secondary = head.slice(5, 10).trimEnd();
    if (secondary.length === 0)
        return primary;
    return `${primary} ${secondary}`;
}
/** LOOK/EXAMI stay in the escape list for ordering but group with "other" no-progress in prompts. */
const OBSERVATION_ESCAPE_PRIMARIES = new Set([
    "LOOK",
    "EXAMI",
]);
/**
 * True for compass, travel-list primaries (ROAD, ENTER, …), and false for LOOK/EXAMI and
 * noun-as-primary lines (e.g. KEYS). Used to split no-progress lists in planner prompts.
 */
export function isBlockedTravelOrExitPrimary(primary) {
    const p = primary.toUpperCase().trim();
    if (OBSERVATION_ESCAPE_PRIMARIES.has(p))
        return false;
    if (isGridMotionPrimary(p))
        return true;
    return autoplayEscapePrimaryOrder().includes(p);
}
/**
 * True when the primary is a plausible direction, travel token, or known verb for graph labels.
 * Noun primaries (KEYS as column 1) are false so edges can be annotated.
 */
export function isLegitimateGraphEdgePrimary(primary) {
    const p = primary.toUpperCase().trim();
    if (isGridMotionPrimary(p))
        return true;
    if (autoplayEscapePrimaryOrder().includes(p))
        return true;
    if (isNonLocationObjectPrimary(p))
        return true;
    if (TAKE_VERB_PRIMARIES_FOR_ROOM.has(p))
        return true;
    if (DROP_VERB_PRIMARIES_FOR_ROOM.has(p))
        return true;
    return false;
}
/**
 * Label for session FSM edges and tried-command lists: same as {@link fsmLabelFromGetinCommand},
 * or with a short hint when column 1 is an object word (prefer TAKE/GET + object).
 */
export function graphEdgeLabelFromCommand(command) {
    const primary = primaryFromGetinCommand(command);
    let secondary = secondaryFromGetinCommand(command).trim();
    if (secondary.length > 0 && travelMotionPrimaryIgnoresSecondColumn(primary)) {
        secondary = "";
    }
    const base = secondary.length === 0 ? primary : `${primary} ${secondary}`;
    if (isLegitimateGraphEdgePrimary(primary))
        return base;
    return `${base} (use TAKE/GET + object)`;
}
function formatAxisDelta(axis, n) {
    if (n === 0)
        return null;
    const sign = n > 0 ? "+" : "";
    return `Δ${axis}${sign}${n}`;
}
/**
 * Short hint for dashboard captions: how this primary maps on the inferred grid (not engine truth).
 * Returns null when the primary has no entry in {@link MOTION_GRID_DELTA}.
 */
export function describeMotionGridDelta(primary) {
    const p = primary.toUpperCase().trim();
    const d = MOTION_GRID_DELTA[p];
    if (d === undefined)
        return null;
    const parts = [];
    const ax = formatAxisDelta("x", d.dx);
    const ay = formatAxisDelta("y", d.dy);
    const az = formatAxisDelta("z", d.dz);
    if (ax)
        parts.push(ax);
    if (ay)
        parts.push(ay);
    if (az)
        parts.push(az);
    if (parts.length === 0)
        return null;
    return `map ${parts.join(",")}`;
}
function fingerprintFromAutoplayTurn(t) {
    return (t.outcomeLocationFingerprint ??
        fingerprintLocationFromExcerpt(t.outcomeExcerpt));
}
/**
 * True when the last `minSameTurns` successful turns share the same location fingerprint.
 */
export function detectLocationStagnation(turns, minSameTurns = 3) {
    const ok = turns.filter((t) => !t.outcomeWasParserRejection);
    if (ok.length < minSameTurns)
        return false;
    const slice = ok.slice(-minSameTurns);
    const fp0 = fingerprintFromAutoplayTurn(slice[0]);
    return slice.every((t) => fingerprintFromAutoplayTurn(t) === fp0);
}
function firstRoomFingerprintFromTranscript(transcript) {
    const lines = transcript.replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
        const t = line.trim();
        if (t.length === 0)
            continue;
        const u = t.toUpperCase();
        if (u.startsWith("YOU ARE") || u.includes("END OF A ROAD")) {
            return fingerprintLocationFromGameOutput(t.slice(0, Math.min(t.length, 200)));
        }
    }
    const fromCollapsed = fingerprintLocationFromGameOutput(transcript);
    if (fromCollapsed.length > 0)
        return fromCollapsed;
    const trimmed = transcript.trim();
    if (trimmed.length > 0) {
        return fingerprintLocationFromExcerpt(trimmed.slice(-500));
    }
    return null;
}
export class InferredExplorationMap {
    currentVec = { x: 0, y: 0, z: 0 };
    lastFingerprint = null;
    /** Non-maze fingerprints only — maze rooms share text and use {@link mazeEdges}. */
    landmarkFpToVec = new Map();
    /** Every discovered cell key → latest location fingerprint seen there. */
    cellKeyToFingerprint = new Map();
    /** Maze / duplicate-text rooms: directed edges for grid primaries (inverse for backtracking). */
    mazeEdges = new Map();
    /** cellKey -> primary -> last outcome from that cell */
    exitOutcomes = new Map();
    /** Session-learned directed edges for FSM visualization (capped). */
    directedEdges = [];
    /** nodeId → tried commands (capped per node). */
    triedByNode = new Map();
    /** nodeId → object / non-navigation actions (capped per node). */
    localActionsByNode = new Map();
    /** cellKey → objects believed on the ground (session model; refreshed from room text when available). */
    cellKeyToGroundObjects = new Map();
    /** Dedupes FSM edges: same from→to, kind, and motion-equivalent command (e.g. N vs NORTH). */
    graphEdgeDedupKeys = new Set();
    /** Last motion primary attempted from each cell (canonical) — deprioritized in escape order. */
    lastMotionPrimaryByCell = new Map();
    orderEscapePrimariesForCell(cellKey) {
        const base = orderedEscapePrimariesForCellKey(cellKey);
        const last = this.lastMotionPrimaryByCell.get(cellKey);
        return deprioritizeLastPrimary(base, last);
    }
    pushGraphEdge(from, to, label, kind, command) {
        const dedupKey = `${from}\x1f${to}\x1f${kind}\x1f${normalizeGetinLineKeyForGraphDedup(command)}`;
        if (this.graphEdgeDedupKeys.has(dedupKey))
            return;
        this.graphEdgeDedupKeys.add(dedupKey);
        const lineKey = normalizeGetinLineKeyForGraphDedup(command);
        if (this.directedEdges.length < MAX_GRAPH_EDGES) {
            this.directedEdges.push({ from, to, label, kind });
        }
        pushTried(this.triedByNode, from, { lineKey, label, kind });
    }
    pushLocalAction(from, label, kind, command) {
        const lineKey = normalizeGetinLineKeyForMap(command);
        pushLocalTried(this.localActionsByNode, from, { lineKey, label, kind });
        /** Informative / non-compass edges on the session graph (self-loop at this node). */
        const graphKind = kind === "reject" ? "reject" : "action";
        this.pushGraphEdge(from, from, label, graphKind, command);
    }
    seedFromTranscript(transcript, options) {
        let fp = firstRoomFingerprintFromTranscript(transcript);
        if (fp === null || fp.length === 0) {
            const t = transcript.trim();
            if (t.length > 0)
                fp = fingerprintLocationFromExcerpt(t.slice(-600));
        }
        if (fp !== null && fp.length > 0) {
            const canon = canonicalExplorationFingerprint(fp);
            this.lastFingerprint = canon;
            this.currentVec = { x: 0, y: 0, z: 0 };
            this.cellKeyToFingerprint.set(vecKey(this.currentVec), canon);
            if (!isMazeFingerprint(canon)) {
                this.landmarkFpToVec.set(canon, this.currentVec);
            }
        }
        const db = options?.adventureDb;
        if (db !== undefined) {
            const listed = listVisibleAdventureObjectsInText(db, transcript);
            if (listed.length > 0) {
                this.cellKeyToGroundObjects.set(vecKey(this.currentVec), new Set(listed));
            }
        }
    }
    getCurrentVec() {
        return this.currentVec;
    }
    getLastFingerprint() {
        return this.lastFingerprint;
    }
    getDiscoveredRoomCount() {
        return this.cellKeyToFingerprint.size;
    }
    setOutcome(cellKey, primary, kind) {
        let m = this.exitOutcomes.get(cellKey);
        if (!m) {
            m = new Map();
            this.exitOutcomes.set(cellKey, m);
        }
        m.set(primary, kind);
    }
    getExitOutcome(cellKey, primary) {
        return this.exitOutcomes.get(cellKey)?.get(primary);
    }
    currentCellKey() {
        return vecKey(this.currentVec);
    }
    /**
     * Primaries tried from the current cell with outcome `same` or `reject` (for prompts).
     */
    getDeadEndPrimariesFromCurrentCell() {
        const { travel, other } = this.partitionDeadEndPrimariesFromCurrentCell();
        return [...travel, ...other].sort((a, b) => a.localeCompare(b));
    }
    /**
     * Same-room / rejected primaries split for prompts: travel & compass vs LOOK / objects / other.
     */
    partitionDeadEndPrimariesFromCurrentCell() {
        const m = this.exitOutcomes.get(this.currentCellKey());
        if (!m)
            return { travel: [], other: [] };
        const travel = [];
        const other = [];
        for (const [p, k] of m) {
            if (k !== "same" && k !== "reject")
                continue;
            if (isBlockedTravelOrExitPrimary(p))
                travel.push(p);
            else
                other.push(p);
        }
        travel.sort((a, b) => a.localeCompare(b));
        other.sort((a, b) => a.localeCompare(b));
        return { travel, other };
    }
    /**
     * Motion primaries worth suggesting as **fresh** tries from this cell (Try-next line).
     * Excludes `same` / `reject`, optional NULL keys, and travel/exit primaries that already
     * **moved** the player from this cell (those belong in **Known exits**, not as “try next”).
     */
    getUntriedMotionPrimaries(excludeLineKeys) {
        const m = this.exitOutcomes.get(this.currentCellKey());
        const dead = new Set();
        if (m) {
            for (const [p, k] of m) {
                if (k === "same" || k === "reject")
                    dead.add(p);
                else if (k === "moved" && isBlockedTravelOrExitPrimary(p))
                    dead.add(p);
            }
        }
        return this.orderEscapePrimariesForCell(this.currentCellKey()).filter((p) => {
            if (dead.has(p))
                return false;
            if (excludeLineKeys) {
                const line = `${p.padEnd(5, " ")}${" ".repeat(5)}`;
                if (excludeLineKeys.has(line))
                    return false;
            }
            return true;
        });
    }
    isCellKeyOccupied(key) {
        return this.cellKeyToFingerprint.has(key);
    }
    allocateTeleportFrom(base) {
        const occupied = new Set(this.cellKeyToFingerprint.keys());
        for (let i = 1; i < 10_000; i++) {
            const candidate = { x: base.x + i, y: base.y, z: base.z };
            if (!occupied.has(vecKey(candidate)))
                return candidate;
        }
        return { x: base.x + 1, y: base.y, z: base.z };
    }
    addMazeEdge(fromKey, primary, toKey) {
        let m = this.mazeEdges.get(fromKey);
        if (!m) {
            m = new Map();
            this.mazeEdges.set(fromKey, m);
        }
        m.set(primary, toKey);
    }
    applyGridOrTeleport(from, primary) {
        const delta = MOTION_GRID_DELTA[primary];
        if (delta !== undefined) {
            const candidate = addVec(from, delta);
            const key = vecKey(candidate);
            if (!this.isCellKeyOccupied(key))
                return candidate;
            // Pure vertical step (IN/OUT/UP/DOWN): if the target cell is already known, it is almost
            // always the same place with a different location string (e.g. OUT from well house →
            // "YOU'RE AT END OF ROAD AGAIN" vs seed "YOU ARE STANDING…"). Snap to `candidate` so z
            // updates; do not use allocateTeleportFrom (which only walks +x and would keep z wrong).
            const dzOnly = delta.dx === 0 && delta.dy === 0 && delta.dz !== 0;
            if (dzOnly)
                return candidate;
            return this.allocateTeleportFrom(from);
        }
        return this.allocateTeleportFrom(from);
    }
    /**
     * Update map after a turn (call after appending the turn to the session log).
     * @param gameOutputForFingerprint — full game output or excerpt; location line is extracted when possible.
     * @param options.adventureDb — when set, tracks per-cell ground objects from room text and take/drop.
     * @param options.outcomeHadFortranOk — when set, take/drop secondaries adjust ground-object sets.
     */
    recordOutcome(command, gameOutputForFingerprint, outcomeWasParserRejection, outcomeWasBlockedMove = false, options) {
        const cellBeforeKey = vecKey(this.currentVec);
        try {
            const primary = primaryFromGetinCommand(command);
            const edgeLabel = graphEdgeLabelFromCommand(command);
            this.lastMotionPrimaryByCell.set(cellBeforeKey, canonicalMotionPrimaryForDedup(primary));
            const fromGraphId = graphNodeIdFromCellKey(cellBeforeKey);
            const fpStrict = locationFingerprintFromGameOutputStrict(gameOutputForFingerprint);
            const fp = sessionLocationFingerprintFromGameOutput(gameOutputForFingerprint, this.lastFingerprint);
            const isLocal = isNonLocationObjectPrimary(primary);
            if (outcomeWasParserRejection) {
                this.setOutcome(cellBeforeKey, primary, "reject");
                if (isLocal) {
                    this.pushLocalAction(fromGraphId, edgeLabel, "reject", command);
                }
                else {
                    this.pushGraphEdge(fromGraphId, fromGraphId, edgeLabel, "reject", command);
                }
                return;
            }
            if (isLocal) {
                if (outcomeWasBlockedMove) {
                    this.setOutcome(cellBeforeKey, primary, "same");
                    this.pushLocalAction(fromGraphId, edgeLabel, "self", command);
                    return;
                }
                const sameRoom = fpStrict === null ||
                    (this.lastFingerprint !== null && fp === this.lastFingerprint);
                if (sameRoom) {
                    const mazeGridMove = isMazeFingerprint(fp) && isGridMotionPrimary(primary);
                    if (!mazeGridMove) {
                        this.setOutcome(cellBeforeKey, primary, "same");
                        this.pushLocalAction(fromGraphId, edgeLabel, "self", command);
                        return;
                    }
                }
                this.setOutcome(cellBeforeKey, primary, "moved");
                if (fpStrict !== null) {
                    this.lastFingerprint = fp;
                    this.cellKeyToFingerprint.set(vecKey(this.currentVec), fp);
                }
                this.pushLocalAction(fromGraphId, edgeLabel, "apply", command);
                return;
            }
            if (outcomeWasBlockedMove) {
                this.setOutcome(cellBeforeKey, primary, "same");
                this.pushGraphEdge(fromGraphId, fromGraphId, edgeLabel, "self", command);
                return;
            }
            if (this.lastFingerprint !== null && fp === this.lastFingerprint) {
                const mazeGridMove = isMazeFingerprint(fp) && isGridMotionPrimary(primary);
                if (!mazeGridMove) {
                    this.setOutcome(cellBeforeKey, primary, "same");
                    this.pushGraphEdge(fromGraphId, fromGraphId, edgeLabel, "self", command);
                    return;
                }
            }
            this.setOutcome(cellBeforeKey, primary, "moved");
            const destIsMaze = isMazeFingerprint(fp);
            if (destIsMaze) {
                const existingDest = this.mazeEdges.get(cellBeforeKey)?.get(primary);
                if (existingDest !== undefined) {
                    this.currentVec = parseVecKey(existingDest);
                }
                else {
                    const newVec = this.applyGridOrTeleport(this.currentVec, primary);
                    const newKey = vecKey(newVec);
                    this.addMazeEdge(cellBeforeKey, primary, newKey);
                    const inv = inverseMotionPrimary(primary);
                    if (inv !== undefined && isGridMotionPrimary(inv)) {
                        this.addMazeEdge(newKey, inv, cellBeforeKey);
                    }
                    this.currentVec = newVec;
                }
                this.cellKeyToFingerprint.set(vecKey(this.currentVec), fp);
                this.lastFingerprint = fp;
                const toId = graphNodeIdFromCellKey(vecKey(this.currentVec));
                this.pushGraphEdge(fromGraphId, toId, edgeLabel, "move", command);
                return;
            }
            const knownLandmark = this.landmarkFpToVec.get(fp);
            if (knownLandmark !== undefined) {
                this.currentVec = knownLandmark;
            }
            else {
                const newVec = this.applyGridOrTeleport(this.currentVec, primary);
                this.currentVec = newVec;
                this.landmarkFpToVec.set(fp, this.currentVec);
                this.cellKeyToFingerprint.set(vecKey(this.currentVec), fp);
                this.lastFingerprint = fp;
                const toId = graphNodeIdFromCellKey(vecKey(this.currentVec));
                this.pushGraphEdge(fromGraphId, toId, edgeLabel, "move", command);
                return;
            }
            this.cellKeyToFingerprint.set(vecKey(this.currentVec), fp);
            this.lastFingerprint = fp;
            const toId = graphNodeIdFromCellKey(vecKey(this.currentVec));
            this.pushGraphEdge(fromGraphId, toId, edgeLabel, "move", command);
        }
        finally {
            this.applyGroundObjectModelAfterOutcome(command, gameOutputForFingerprint, outcomeWasParserRejection, cellBeforeKey, options);
        }
    }
    /**
     * Refresh per-cell ground objects from room text; remove on successful take, add on drop.
     */
    applyGroundObjectModelAfterOutcome(command, gameOutputForFingerprint, outcomeWasParserRejection, cellBeforeKey, options) {
        const db = options?.adventureDb;
        if (db === undefined)
            return;
        if (outcomeWasParserRejection)
            return;
        const keyAfter = vecKey(this.currentVec);
        const listed = listVisibleAdventureObjectsInText(db, gameOutputForFingerprint);
        if (listed.length > 0) {
            this.cellKeyToGroundObjects.set(keyAfter, new Set(listed));
        }
        const ok = options?.outcomeHadFortranOk === true;
        if (!ok)
            return;
        const primary = primaryFromGetinCommand(command);
        const secRaw = secondaryFromGetinCommand(command);
        if (secRaw.length === 0)
            return;
        const obj = matchSecondaryToObjectAtabWord(secRaw, db);
        if (obj === undefined)
            return;
        if (TAKE_VERB_PRIMARIES_FOR_ROOM.has(primary)) {
            const g = this.cellKeyToGroundObjects.get(cellBeforeKey);
            if (g)
                g.delete(obj);
        }
        else if (DROP_VERB_PRIMARIES_FOR_ROOM.has(primary)) {
            let g = this.cellKeyToGroundObjects.get(keyAfter);
            if (!g) {
                g = new Set();
                this.cellKeyToGroundObjects.set(keyAfter, g);
            }
            g.add(obj);
        }
    }
    formatPromptLines(options) {
        const compact = options?.compact ?? false;
        const v = this.currentVec;
        const n = this.getDiscoveredRoomCount();
        const { travel: deadTravel, other: deadOther } = this.partitionDeadEndPrimariesFromCurrentCell();
        const tryNext = this.getUntriedMotionPrimaries(options?.excludeLineKeys).slice(0, 12);
        const head = compact
            ? `Inferred position (x,y,z)=(${v.x},${v.y},${v.z}); rooms~${n}.`
            : `Inferred position (3D layout hint; connectivity = session FSM edges): (x,y,z) = (${v.x}, ${v.y}, ${v.z}). East=+x, North=+y, Up=+z.`;
        const lines = [head];
        lines.push("Location graph (dashboard FSM): solid = travel; dashed gray = rejected move; dotted blue = non-move actions (TAKE, LOOK, …) at that node. See also non-location action lists in telemetry.");
        lines.push("IN and OUT also change inferred z (depth), not only UP/DOWN; outdoors, OUT may still be rejected by the parser.");
        if (deadTravel.length > 0) {
            lines.push(`Already explored from here (travel / compass / exits — session): ${deadTravel.join(", ")}.`);
        }
        if (deadOther.length > 0) {
            lines.push(`Already explored from here (LOOK / objects / other — session): ${deadOther.join(", ")}.`);
        }
        if (tryNext.length > 0) {
            lines.push(`Good next options from here (session): ${tryNext.join(", ")}.`);
        }
        return lines;
    }
    /**
     * Pick a primary token for deterministic escape; respects parser-rejected GETIN keys (primary-only).
     */
    pickEscapePrimary(rejectedLineKeys, nullLineKeys) {
        const cellKey = this.currentCellKey();
        for (const token of this.orderEscapePrimariesForCell(cellKey)) {
            const line = `${token.padEnd(5, " ")}${" ".repeat(5)}`;
            if (rejectedLineKeys.has(line))
                continue;
            if (nullLineKeys?.has(line))
                continue;
            const o = this.getExitOutcome(cellKey, token);
            if (o === "same" || o === "reject")
                continue;
            return token;
        }
        return null;
    }
    /** Read-only snapshot for UI / logging (wrapper heuristic, not engine truth). */
    toSnapshot(options) {
        const inv = options?.inventoryObjectAtabWords ?? new Set();
        const cells = [];
        for (const [key, fp] of this.cellKeyToFingerprint) {
            const v = parseVecKey(key);
            const { roomKind, label } = classifyRoomFingerprint(fp);
            const ground = this.cellKeyToGroundObjects.get(key);
            const groundArr = ground === undefined
                ? null
                : [...ground].sort((a, b) => a.localeCompare(b));
            let takeableArr = null;
            if (ground !== undefined) {
                takeableArr = [...ground]
                    .filter((o) => !inv.has(o))
                    .sort((a, b) => a.localeCompare(b));
            }
            cells.push({
                graphNodeId: graphNodeIdFromCellKey(key),
                x: v.x,
                y: v.y,
                z: v.z,
                fingerprint: fp,
                roomKind,
                label,
                groundObjectWords: groundArr,
                takeableObjectWords: takeableArr,
                visibleObjectCount: takeableArr === null ? null : takeableArr.length,
            });
        }
        cells.sort((a, b) => {
            if (a.z !== b.z)
                return a.z - b.z;
            if (a.y !== b.y)
                return b.y - a.y;
            return a.x - b.x;
        });
        const exitOutcomes = {};
        for (const [cellKey, primMap] of this.exitOutcomes) {
            const row = [];
            for (const [primary, outcome] of primMap) {
                row.push({ primary, outcome });
            }
            row.sort((a, b) => a.primary.localeCompare(b.primary));
            exitOutcomes[cellKey] = row;
        }
        const triedCommandsByNode = {};
        for (const [nid, arr] of this.triedByNode) {
            triedCommandsByNode[nid] = [...arr];
        }
        const nonLocationActionsByNode = {};
        for (const [nid, arr] of this.localActionsByNode) {
            nonLocationActionsByNode[nid] = [...arr];
        }
        return {
            current: { ...this.currentVec },
            currentGraphNodeId: graphNodeIdFromCellKey(vecKey(this.currentVec)),
            lastFingerprint: this.lastFingerprint,
            cells,
            exitOutcomes,
            directedEdges: [...this.directedEdges],
            triedCommandsByNode,
            nonLocationActionsByNode,
        };
    }
}
//# sourceMappingURL=inferredExplorationMap.js.map