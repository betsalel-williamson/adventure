/**
 * In-process session memory for self-acting (autoplay) mode: event log, heuristic
 * derived state, and budgeted prompt text for stateless TextLlm calls.
 * MLX structured prompts: system (rules + JSON + flat vocabulary) + compact user body in `buildPlannerMxStructuredPrompt`.
 * Shared role/rules for other paths: {@link linesForAutoplayPlannerContextBody}.
 */
import { autoplayPlannerTaskBlockStructured, linesForAutoplayPlannerContextBody, mlxAutoplaySystemPrompt, resolveAutoplayPromptMode, } from "./adventureNlPrompts.js";
import { buildSituationalCandidateTokens, formatSituationalCandidatesSection, listVisibleAdventureObjectsInText, matchSecondaryToObjectAtabWord, recentTextSuggestsIndoorBuildingNavigation, shouldPrioritizeLootFunnel, stripInjectedCommandLinesForObjectHints, } from "./situationalCandidates.js";
import { interpretedToGetinLine, } from "./schema.js";
import { LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS } from "./llmPackagingConstants.js";
import { detectLocationStagnation, graphNodeIdFromCellKey, sessionLocationFingerprintFromGameOutput, InferredExplorationMap, } from "./inferredExplorationMap.js";
import { graphNodeCaptionForSnapshot, inferredMapToDot, inferredMapToMermaid, } from "./explorationGraphViz.js";
const MAX_INTERNAL_RAW = LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS;
/** Cap "recent command" lines in structured dashboard (RTFM: keep history short). */
const DASHBOARD_RECENT_COMMANDS = 8;
const ONE_LINE_OUTCOME_MAX = 160;
/** Max GETIN lines remembered as parser-rejected (FIFO, deduped). */
const MAX_REJECTED_GETIN_QUEUE = 32;
/** Successive non-rejection turns with the same location fingerprint → stagnation. */
const STAGNATION_MIN_SAME_TURNS = 3;
/**
 * Detect Colossal Cave-style parser rejections from full game output (case-insensitive).
 * Used so autoplay can tell the planner not to repeat the same token.
 */
export function gameOutputLooksLikeParserRejection(text) {
    const u = text.toUpperCase();
    return (u.includes("I DON'T KNOW HOW TO APPLY THAT WORD HERE") ||
        u.includes("I DON'T UNDERSTAND THAT") ||
        u.includes("I DON'T KNOW THAT WORD") ||
        u.includes("I DON'T KNOW IN FROM OUT HERE") ||
        u.includes("I DON'T KNOW HOW TO LOCK OR UNLOCK SUCH A THING") ||
        u.includes("NOTHING HAPPENS"));
}
/** True when movement in a compass direction was refused (room unchanged). */
export function gameOutputLooksLikeBlockedMove(text) {
    const u = text.toUpperCase();
    return u.includes("THERE IS NO WAY TO GO THAT DIRECTION");
}
/**
 * True when the engine is asking whether to restart after death (e.g. LTEXT 81: PLAY AGAIN?).
 * The stock YES() routine treats any GETIN primary other than N / NO as affirmative.
 */
export function gameOutputLooksLikePlayAgainPrompt(text) {
    const u = text.toUpperCase();
    return u.includes("GAME IS OVER") && u.includes("PLAY AGAIN");
}
/**
 * Canonical 10-character GETIN key (two five-letter columns, space-padded) for comparing lines.
 */
export function normalizeGetinLineKey(line) {
    const t = line.replace(/\r/g, "").toUpperCase().trim();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    const primary = head.slice(0, 5).trimEnd().padEnd(5, " ");
    const secondary = head.slice(5, 10).trimEnd().padEnd(5, " ");
    return `${primary}${secondary}`;
}
function formatRejectedGetinForPrompt(key) {
    const p = key.slice(0, 5).trimEnd();
    const s = key.slice(5, 10).trimEnd();
    if (s.length === 0)
        return `\`${p}\` (primary only)`;
    return `\`${p}\` + \`${s}\``;
}
const ESCAPE_PRIMARY_TOKENS = [
    "LOOK",
    "EXAMI",
    "EAST",
    "WEST",
    "NORTH",
    "SOUTH",
    "UP",
    "DOWN",
    "IN",
    "OUT",
];
function objectAtabFromTakeGetSecondary(secondary, db) {
    const sec = secondary.trim().toUpperCase();
    if (sec.length === 0)
        return undefined;
    return matchSecondaryToObjectAtabWord(sec, db) ?? sec.slice(0, 5).trimEnd();
}
function oneLineExcerpt(text, maxLen) {
    const t = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    if (t.length <= maxLen)
        return t;
    return `${t.slice(0, maxLen - 1)}…`;
}
function getPrimaryFromStoredCommand(command) {
    const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
    const head = (t.length >= 5 ? t.slice(0, 5) : t.padEnd(5, " ")).slice(0, 5);
    return head.trimEnd();
}
/** Short primary or PRIMARY+SECONDARY for planner **History** lines. */
function formatPlannerCommandAbbrev(command) {
    const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
    const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(0, 10);
    const p = head.slice(0, 5).trimEnd();
    const s = head.slice(5, 10).trimEnd();
    return s.length > 0 ? `${p}+${s}` : p;
}
/**
 * Detect A→B→A→B movement: same command, alternating location lines, parser accepted each time.
 * Typical cause: bidirectional travel (e.g. ROAD) with a small model that keeps re-picking the same verb.
 */
export function detectAlternatingLocationCommandLoop(turns) {
    const ok = turns.filter((t) => !t.outcomeWasParserRejection);
    if (ok.length < 4)
        return null;
    const last4 = ok.slice(-4);
    const fp = last4.map((t) => t.outcomeLocationFingerprint);
    const primaries = last4.map((t) => getPrimaryFromStoredCommand(t.command));
    if (fp[0] !== fp[2] || fp[1] !== fp[3])
        return null;
    if (fp[0] === fp[1])
        return null;
    if (primaries[0] !== primaries[1] ||
        primaries[0] !== primaries[2] ||
        primaries[0] !== primaries[3]) {
        return null;
    }
    return {
        repeatedPrimary: primaries[0],
        locA: fp[0],
        locB: fp[1],
    };
}
/**
 * After death + "play again", Fortran jumps to label 1100 and prints `INIT DONE`
 * before re-seeding the world. Inventory heuristics must ignore transcript and
 * TAKE history from before that point.
 */
function transcriptAfterLastFortranInit(text) {
    const lower = text.toLowerCase();
    const marker = "init done";
    const idx = lower.lastIndexOf(marker);
    if (idx < 0)
        return text;
    return text.slice(idx + marker.length).replace(/^[\s\r\n]*/, "");
}
function extractInventoryFromText(text) {
    const u = text.toUpperCase();
    const out = [];
    const carryingIdx = u.lastIndexOf("YOU ARE CARRYING");
    if (carryingIdx >= 0) {
        const slice = text.slice(carryingIdx);
        const lines = slice.split(/\n/).slice(0, 8);
        for (const line of lines) {
            const t = line.trim();
            if (t.length === 0)
                continue;
            if (/^YOU ARE CARRYING/i.test(t))
                continue;
            if (/^YOU ARE (NOT|EMPTY|IN )/i.test(t))
                break;
            if (/^YOU (CAN|DON'T|SEE|ARE|HAVE)/i.test(t) && out.length > 0)
                break;
            if (/^>/m.test(t))
                break;
            if (t.length > 2)
                out.push(t.slice(0, 80));
        }
    }
    if (out.length === 0) {
        const m = u.match(/\bNOW CARRYING\b[^.\n]*([^\n]+)/i);
        if (m?.[1])
            out.push(m[1].trim().slice(0, 80));
    }
    return out.slice(0, 12);
}
/** adventure.dat verb group 2001 (GETIN primary, 5-letter column). */
const INVENTORY_TAKE_VERB_PRIMARIES = new Set([
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
/** adventure.dat verb group 2002 */
const INVENTORY_DROP_VERB_PRIMARIES = new Set([
    "RELEA",
    "FREE",
    "DISCA",
    "DROP",
    "DUMP",
]);
function parseGetinPrimarySecondary(command) {
    const t = command.replace(/\r/g, "").trim();
    const upper = t.toUpperCase();
    const words = upper.split(/\s+/).filter(Boolean);
    if (words.length === 1 && words[0].length > 5) {
        const w = words[0];
        return {
            primary: w.slice(0, 5).trimEnd(),
            secondary: w.slice(5, 10).trimEnd(),
        };
    }
    if (words.length >= 2) {
        const primary = words[0].slice(0, 5).trimEnd();
        const takeOrDrop = INVENTORY_TAKE_VERB_PRIMARIES.has(primary) ||
            INVENTORY_DROP_VERB_PRIMARIES.has(primary);
        if (words.length >= 3 && takeOrDrop) {
            return {
                primary,
                secondary: words[words.length - 1].slice(0, 5).trimEnd(),
            };
        }
        return {
            primary,
            secondary: words[1].slice(0, 5).trimEnd(),
        };
    }
    const primary = upper.slice(0, 5).trimEnd();
    const secondary = upper.length > 5 ? upper.slice(5, 10).trimEnd() : "";
    return { primary, secondary };
}
/**
 * One line for the planner transcript: the GETIN command the player sent before the
 * following engine text (not echoed by all builds — we inject it for context).
 */
function formatPlayerCommandLineForTranscript(command) {
    const { primary, secondary } = parseGetinPrimarySecondary(command);
    const p = primary.trim();
    const s = secondary.trim();
    if (!p)
        return "";
    if (!s)
        return `> ${p}`;
    return `> ${p} ${s}`;
}
/**
 * True when Fortran likely printed SPEAK(54) ("OK") for a successful take/drop.
 * The stock engine does not list inventory after TAKE; it only prints OK.
 */
function outcomeLooksLikeFortranOkSuccess(gameOutput) {
    if (gameOutputLooksLikeParserRejection(gameOutput))
        return false;
    const n = gameOutput.replace(/\r\n/g, "\n").trim();
    if (n.length === 0)
        return false;
    const u = n.toUpperCase();
    if (u.includes("I SEE NO"))
        return false;
    if (u.includes("YOU AREN'T CARRYING"))
        return false;
    if (u.includes("YOU ARE ALREADY CARRYING"))
        return false;
    if (u.includes("I DON'T KNOW"))
        return false;
    if (u.includes("YOU CAN'T"))
        return false;
    if (u.includes("NOTHING HAPPENS"))
        return false;
    const lines = n
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const scan = Math.min(lines.length, 80);
    for (let i = 0; i < scan; i++) {
        const line = lines[i].toUpperCase();
        if (line === "OK" ||
            line.startsWith("OK ") ||
            line.startsWith("OK.") ||
            line.startsWith("OK,")) {
            return true;
        }
    }
    return false;
}
function inferCarriedInventoryFromTurnHistory(turns) {
    const carried = [];
    for (const t of turns) {
        if (t.outcomeWasParserRejection || !t.outcomeHadFortranOk)
            continue;
        const { primary, secondary } = parseGetinPrimarySecondary(t.command);
        if (!secondary)
            continue;
        const obj = secondary.toUpperCase();
        if (INVENTORY_TAKE_VERB_PRIMARIES.has(primary)) {
            if (!carried.includes(obj))
                carried.push(obj);
        }
        else if (INVENTORY_DROP_VERB_PRIMARIES.has(primary)) {
            const ix = carried.indexOf(obj);
            if (ix >= 0)
                carried.splice(ix, 1);
        }
    }
    return carried.slice(0, 12);
}
/**
 * True for a line that looks like the engine’s room description (not inventory / carrying).
 * Align with non-place lines in {@link inferredExplorationMap} so “already carrying” never becomes Location.
 */
function lineLooksLikeGameLocationLine(line) {
    const u = line.trim().toUpperCase();
    if (u.length === 0)
        return false;
    if (u.startsWith("YOU ARE CARRYING"))
        return false;
    if (u.includes("YOU ARE CARRYING:"))
        return false;
    if (u.includes("YOU ARE ALREADY CARRYING") ||
        u.includes("YOU'RE ALREADY CARRYING"))
        return false;
    if (u.includes("ALREADY CARRYING"))
        return false;
    if (u.startsWith("YOU ARE") || u.startsWith("YOU'RE"))
        return true;
    if (u.includes("END OF A ROAD") ||
        u.includes("WELL HOUSE") ||
        u.includes("IN A VALLEY")) {
        return true;
    }
    return false;
}
/** Collapse line breaks and repeated spaces for prompt lines; do not drop room words. */
function formatLocationHintForPlanner(text) {
    return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}
/**
 * True when a transcript line ends the current room-description block (blank, command, meta).
 */
function lineBreaksRoomDescriptionContinuation(line) {
    const u = line.trim().toUpperCase();
    if (u.length === 0)
        return true;
    if (u.startsWith(">"))
        return true;
    if (u.startsWith("YOU ARE CARRYING"))
        return true;
    if (u.includes("YOU ARE CARRYING:"))
        return true;
    if (u.includes("YOU ARE ALREADY CARRYING") ||
        u.includes("YOU'RE ALREADY CARRYING")) {
        return true;
    }
    if (u.includes("I DON'T KNOW HOW TO APPLY"))
        return true;
    if (u.includes("I DON'T UNDERSTAND THAT"))
        return true;
    if (u.includes("NOTHING HAPPENS"))
        return true;
    if (u.includes("THERE IS NO WAY TO GO THAT DIRECTION"))
        return true;
    if (u === "OK" ||
        u.startsWith("OK ") ||
        u.startsWith("OK.") ||
        u.startsWith("OK,")) {
        return true;
    }
    if (u.includes("GAME IS OVER") && u.includes("PLAY AGAIN"))
        return true;
    return false;
}
/** Safety cap only for corrupted huge tails; typical rooms stay well under this. */
const LOCATION_HINT_MAX_CHARS = 6000;
/**
 * Latest contiguous room-description block (YOU ARE / YOU'RE header + wrapped lines), or "".
 * Used to scope **Items** / object **Cand** to the **current** room so stale GRATE/WATER in the
 * tail does not hijack loot / vertical cues after the player moves.
 */
export function extractLatestRoomDescriptionBlock(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
        const t = lines[i].trim();
        if (!lineLooksLikeGameLocationLine(t))
            continue;
        const parts = [];
        for (let j = i; j < lines.length; j++) {
            const raw = lines[j];
            const seg = raw.trim();
            if (j > i) {
                if (seg.length === 0)
                    break;
                if (lineBreaksRoomDescriptionContinuation(raw))
                    break;
                if (lineLooksLikeGameLocationLine(seg))
                    break;
            }
            parts.push(seg);
        }
        if (parts.length > 0)
            return parts.join("\n");
    }
    return "";
}
/**
 * Latest room block — scan bottom-up for a location line, then forward for wrapped Fortran lines.
 * Content is not truncated to a short prefix; only whitespace is normalized for **Loc:** readability.
 */
function extractLocationHint(text) {
    const block = extractLatestRoomDescriptionBlock(text);
    if (block.length === 0)
        return "";
    const formatted = formatLocationHintForPlanner(block);
    if (formatted.length === 0)
        return "";
    if (formatted.length <= LOCATION_HINT_MAX_CHARS)
        return formatted;
    return `${formatted.slice(0, LOCATION_HINT_MAX_CHARS - 1)}…`;
}
function extractObjectNotes(text) {
    const u = text.toUpperCase();
    const notes = [];
    if (/\bLAMP\b.*\b(DIM|OFF|OUT)\b/i.test(text)) {
        notes.push("Lamp may be dim or off (check LOOK).");
    }
    if (u.includes("LAMP IS ON") || u.includes("BRIGHT")) {
        notes.push("Lamp on.");
    }
    if (u.includes("LAMP IS OFF")) {
        notes.push("Lamp off.");
    }
    if (u.includes("LOCKED") || u.includes("KEY")) {
        notes.push("Mention of lock or key.");
    }
    return notes.slice(0, 6);
}
/**
 * Verbs where repeating primary in the same room can still be valid (different object).
 * TAKE/GET are **not** listed so a repeated null TAKE+same-object at this cell can trigger stagnation escape.
 */
const PRIMARY_IGNORE_MAP_DEAD = new Set([
    "DROP",
    "OPEN",
    "LOCK",
    "KILL",
    "FEED",
    "INVE",
]);
function inventorySignature(items) {
    return [...items]
        .map((s) => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join("|");
}
export class AutoplaySessionMemory {
    recentRawTail = "";
    turns = [];
    /**
     * Only turns from this index onward contribute to {@link inferCarriedInventoryFromTurnHistory}.
     * Advanced when Fortran prints INIT DONE (full game re-init after restart).
     */
    inventoryTurnStart = 0;
    /** Structured inventory lines parsed from the transcript (Fortran text is authoritative). */
    inventory = [];
    locationHint = "";
    objectNotes = [];
    /** FIFO of GETIN keys the parser rejected; cleared after any non-rejection outcome. */
    rejectedGetinQueue = [];
    exploration = new InferredExplorationMap();
    /** Set when {@link recordCommandOutcome} or {@link seedOpening} receives `adventureDb`. */
    adventureDbRef;
    /** graphNodeId → GETIN keys that were NULL (no location or inventory change). */
    nullCommandKeysByNode = new Map();
    /**
     * Per inferred-map node: ATAB object words where TAKE/GET + object did not succeed (parser/game
     * refusal). Excluded from **Items** / Cand_Obj until the player leaves this cell.
     */
    takeFailedObjectAtabByNodeId = new Map();
    /** ATAB object words from parsed inventory — subtract from room “takeable” on the map. */
    inventoryObjectAtabWordsForMap() {
        if (!this.adventureDbRef || this.inventory.length === 0)
            return undefined;
        return new Set(listVisibleAdventureObjectsInText(this.adventureDbRef, this.inventory.join("\n")));
    }
    mapSnapshotOptions() {
        const inv = this.inventoryObjectAtabWordsForMap();
        return inv ? { inventoryObjectAtabWords: inv } : {};
    }
    recordTakeGetOutcomeLearning(command, gameOutputNorm, nodeIdBefore) {
        if (!this.adventureDbRef)
            return;
        const { primary, secondary } = parseGetinPrimarySecondary(command);
        if (!INVENTORY_TAKE_VERB_PRIMARIES.has(primary))
            return;
        const atab = objectAtabFromTakeGetSecondary(secondary, this.adventureDbRef);
        if (!atab || atab.length === 0)
            return;
        if (outcomeLooksLikeFortranOkSuccess(gameOutputNorm)) {
            const s = this.takeFailedObjectAtabByNodeId.get(nodeIdBefore);
            if (s) {
                s.delete(atab);
                if (s.size === 0) {
                    this.takeFailedObjectAtabByNodeId.delete(nodeIdBefore);
                }
            }
            return;
        }
        let s = this.takeFailedObjectAtabByNodeId.get(nodeIdBefore);
        if (!s) {
            s = new Set();
            this.takeFailedObjectAtabByNodeId.set(nodeIdBefore, s);
        }
        s.add(atab);
    }
    /**
     * Raw accumulated transcript tail (for situational candidate extraction).
     * After each {@link recordCommandOutcome}, a line `> VERB` or `> VERB OBJECT` is
     * inserted immediately before that turn's engine output.
     */
    getRecentRawTail() {
        return this.recentRawTail;
    }
    /**
     * Text slice used for **Items**, loot funnel, Cand_Obj, and vertical-passage cues: the latest
     * room-description block when one can be parsed, else the full stripped tail (same as before).
     */
    getObjectHintScopeText() {
        const block = extractLatestRoomDescriptionBlock(this.recentRawTail);
        const strippedTail = stripInjectedCommandLinesForObjectHints(this.recentRawTail);
        if (block.trim().length === 0)
            return strippedTail;
        return stripInjectedCommandLinesForObjectHints(block);
    }
    /**
     * Object-class tokens to omit from room “takeable” hints after failed TAKE/GET in this cell
     * (e.g. GRATE as scenery).
     */
    getRoomTakeFailureObjectAtabWords() {
        const id = graphNodeIdFromCellKey(this.exploration.currentCellKey());
        const s = this.takeFailedObjectAtabByNodeId.get(id);
        return s ? [...s].sort((a, b) => a.localeCompare(b)) : [];
    }
    /** Seed from transcript before the first `> ` command. */
    seedOpening(transcript, options) {
        if (options?.adventureDb)
            this.adventureDbRef = options.adventureDb;
        const norm = transcript.replace(/\r\n/g, "\n");
        this.recentRawTail = norm.slice(-MAX_INTERNAL_RAW);
        this.refreshDerived(norm);
        this.exploration.seedFromTranscript(norm, options);
    }
    /**
     * Prefix text for interactive NL interpret prompts: heuristic state, short turn log,
     * situational parser-token candidates (parity with autoplay cues). Prepended to raw
     * game output by the CLI; capped so {@link recentGameTextSliceForInterpretPrompt} keeps latest game text.
     */
    /**
     * Inventory items inferred from recent transcript: "YOU ARE CARRYING" blocks when present,
     * otherwise replay of successful TAKE/GET/DROP turns that produced Fortran "OK".
     */
    getStructuredInventory() {
        return this.inventory;
    }
    /** Heuristic location line parsed from recent transcript (may be empty). */
    getLocationHint() {
        return this.locationHint;
    }
    /**
     * Snapshot of heuristic state for dashboards: inferred map, inventory hints, recent moves.
     */
    buildAutoplayUiSnapshot() {
        const recentTurns = this.turns
            .slice(-12)
            .map((t) => ({
            command: t.command,
            outcomeExcerpt: t.outcomeExcerpt,
            outcomeWasParserRejection: t.outcomeWasParserRejection,
        }));
        const map = this.exploration.toSnapshot(this.mapSnapshotOptions());
        const curId = graphNodeIdFromCellKey(this.exploration.currentCellKey());
        const nullSet = this.nullCommandKeysByNode.get(curId);
        return {
            locationHint: this.locationHint,
            inventory: [...this.inventory],
            objectNotes: [...this.objectNotes],
            map,
            mapMermaid: inferredMapToMermaid(map),
            mapDot: inferredMapToDot(map),
            nullCommandKeysAtCurrentNode: nullSet
                ? [...nullSet].sort((a, b) => a.localeCompare(b))
                : [],
            stagnating: this.isLocationStagnating(),
            recentTurns,
            tryNextLine: this.formatExplorationTryNextLine(),
        };
    }
    /** True when the last few successful turns did not change location (see {@link STAGNATION_MIN_SAME_TURNS}). */
    isLocationStagnating() {
        return detectLocationStagnation(this.turns, STAGNATION_MIN_SAME_TURNS);
    }
    /** One line for situational CANDIDATES when stagnating (inferred map). */
    formatExplorationTryNextLine() {
        const nullKeys = this.getNullKeysForCurrentNode();
        const next = this.exploration
            .getUntriedMotionPrimaries(nullKeys)
            .slice(0, 10);
        if (next.length === 0)
            return "";
        return `**Try next (inferred map, not engine truth):** ${next.join(", ")}`;
    }
    getNullKeysForCurrentNode() {
        const id = graphNodeIdFromCellKey(this.exploration.currentCellKey());
        return new Set(this.nullCommandKeysByNode.get(id) ?? []);
    }
    addNullCommandForNode(nodeId, lineKey) {
        let s = this.nullCommandKeysByNode.get(nodeId);
        if (!s) {
            s = new Set();
            this.nullCommandKeysByNode.set(nodeId, s);
        }
        s.add(lineKey);
    }
    buildInteractiveInterpretPrefix(db, options) {
        const maxTotal = options.compact ? 900 : 1400;
        const mapLine = this.exploration
            .formatPromptLines({
            compact: options.compact,
            excludeLineKeys: this.getNullKeysForCurrentNode(),
        })
            .join(" ");
        const lines = [
            "### Interactive session context",
            "(Heuristic — same class of signal as autoplay; Fortran output below is authoritative.)",
            "",
            `**Location hint:** ${this.locationHint || "(unknown)"}`,
            this.inventory.length > 0
                ? `**Inventory (parsed):** ${this.inventory.join("; ")}`
                : "**Inventory (parsed):** (not detected)",
            `**Map (inferred):** ${mapLine}`,
        ];
        if (this.objectNotes.length > 0) {
            lines.push(`**Notes:** ${this.objectNotes.join(" ")}`);
        }
        const turnN = Math.min(this.turns.length, options.compact ? 4 : 8);
        if (turnN > 0) {
            lines.push("");
            lines.push("**Recent moves:**");
            for (const t of this.turns.slice(-turnN)) {
                const tag = t.outcomeWasParserRejection ? " (parser rejected)" : "";
                lines.push(`- \`${t.command}\` → ${t.outcomeExcerpt}${tag}`);
            }
        }
        const objectScope = this.getObjectHintScopeText();
        const indoor = recentTextSuggestsIndoorBuildingNavigation(objectScope);
        const invLines = this.getStructuredInventory();
        const takeFailWords = this.getRoomTakeFailureObjectAtabWords();
        const lootFunnel = shouldPrioritizeLootFunnel(db, objectScope, invLines, takeFailWords);
        const situ = formatSituationalCandidatesSection(db, buildSituationalCandidateTokens(db, this.recentRawTail, {
            indoorLeaveBuilding: indoor,
            exploreFirst: resolveAutoplayPromptMode() === "explore",
            inventorySubtractText: invLines.length > 0 ? invLines.join("\n") : undefined,
            takeFailureSubtractWords: takeFailWords,
            objectHintScopeText: objectScope,
            lootFunnel,
        }), undefined, {
            lootFunnelDeferCandMove: lootFunnel,
        });
        if (situ.trim().length > 0) {
            lines.push("");
            lines.push(situ);
        }
        let out = lines.join("\n").trim();
        if (out.length > maxTotal) {
            out = `${out.slice(0, maxTotal - 1)}…`;
        }
        return out;
    }
    /**
     * Record the GETIN line that was sent and the game output that followed.
     * Pass `adventureDb` so the exploration graph can show visible object counts per room.
     */
    recordCommandOutcome(command, gameOutput, options) {
        if (options?.adventureDb)
            this.adventureDbRef = options.adventureDb;
        const norm = gameOutput.replace(/\r\n/g, "\n");
        const invBefore = inventorySignature(this.inventory);
        const fpBefore = this.exploration.getLastFingerprint();
        const nodeIdBefore = graphNodeIdFromCellKey(this.exploration.currentCellKey());
        const outcomeWasParserRejection = gameOutputLooksLikeParserRejection(norm);
        const outcomeWasBlockedMove = gameOutputLooksLikeBlockedMove(norm);
        const outcomeLocationFingerprint = sessionLocationFingerprintFromGameOutput(norm, fpBefore);
        const outcomeHadFortranOk = outcomeLooksLikeFortranOkSuccess(norm);
        this.recordTakeGetOutcomeLearning(command, norm, nodeIdBefore);
        if (outcomeWasParserRejection) {
            const key = normalizeGetinLineKey(command);
            if (!this.rejectedGetinQueue.includes(key)) {
                this.rejectedGetinQueue.push(key);
                while (this.rejectedGetinQueue.length > MAX_REJECTED_GETIN_QUEUE) {
                    this.rejectedGetinQueue.shift();
                }
            }
        }
        else {
            this.rejectedGetinQueue = [];
        }
        const excerpt = oneLineExcerpt(norm, ONE_LINE_OUTCOME_MAX);
        this.turns.push({
            command: command.trimEnd().slice(0, 24),
            outcomeExcerpt: excerpt,
            outcomeLocationFingerprint,
            outcomeWasParserRejection,
            outcomeHadFortranOk,
        });
        if (this.turns.length > 400) {
            this.turns.shift();
            this.inventoryTurnStart = Math.max(0, this.inventoryTurnStart - 1);
        }
        if (/\bINIT\s+DONE\b/i.test(norm)) {
            this.inventoryTurnStart = this.turns.length;
            this.takeFailedObjectAtabByNodeId.clear();
        }
        const cmdLine = formatPlayerCommandLineForTranscript(command);
        const withCommand = cmdLine.length > 0 ? `${cmdLine}\n${norm}` : norm;
        this.recentRawTail = (this.recentRawTail + withCommand).slice(-MAX_INTERNAL_RAW);
        this.refreshDerived(this.recentRawTail);
        this.exploration.recordOutcome(command.trimEnd().slice(0, 24), norm, outcomeWasParserRejection, outcomeWasBlockedMove, {
            ...options,
            outcomeHadFortranOk: outcomeLooksLikeFortranOkSuccess(norm),
        });
        const cmdKey = normalizeGetinLineKey(command.trimEnd().slice(0, 24));
        if (outcomeWasParserRejection) {
            this.addNullCommandForNode(nodeIdBefore, cmdKey);
        }
        else {
            const invAfter = inventorySignature(this.inventory);
            const fpAfter = sessionLocationFingerprintFromGameOutput(norm, fpBefore);
            if (fpBefore !== null && fpBefore === fpAfter && invBefore === invAfter) {
                this.addNullCommandForNode(nodeIdBefore, cmdKey);
            }
        }
    }
    /**
     * If the planner's GETIN line matches a recently parser-rejected line, substitute a safe
     * one-word command not in the rejection queue (deterministic escape hatch).
     */
    avoidRepeatingRejectedCommand(plan) {
        if (plan.continuePlaying === false)
            return plan;
        const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (quit === "QUIT")
            return plan;
        const cmd = {
            primaryToken: plan.primaryToken,
            secondaryToken: plan.secondaryToken,
            confidence: plan.confidence,
        };
        const lineKey = normalizeGetinLineKey(interpretedToGetinLine(cmd));
        if (!this.rejectedGetinQueue.includes(lineKey))
            return plan;
        for (const primaryToken of ESCAPE_PRIMARY_TOKENS) {
            const candidate = { primaryToken };
            const k = normalizeGetinLineKey(interpretedToGetinLine(candidate));
            if (!this.rejectedGetinQueue.includes(k)) {
                return {
                    ...plan,
                    primaryToken,
                    secondaryToken: undefined,
                    confidence: plan.confidence !== undefined
                        ? Math.min(plan.confidence, 0.35)
                        : 0.25,
                };
            }
        }
        return {
            ...plan,
            primaryToken: "LOOK",
            secondaryToken: undefined,
            confidence: 0.2,
        };
    }
    /**
     * When TAKE/GET targets an object already in parsed inventory, substitute an escape motion.
     */
    avoidRedundantTakeWhenCarrying(plan) {
        if (plan.continuePlaying === false)
            return plan;
        const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (quit === "QUIT")
            return plan;
        const p = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (p !== "TAKE" && p !== "GET")
            return plan;
        const sec = plan.secondaryToken?.trim();
        if (!sec || !this.adventureDbRef)
            return plan;
        const matched = matchSecondaryToObjectAtabWord(sec, this.adventureDbRef);
        if (!matched)
            return plan;
        const carried = this.inventoryObjectAtabWordsForMap();
        if (!carried?.has(matched))
            return plan;
        const rejected = new Set(this.rejectedGetinQueue);
        const nullKeys = this.getNullKeysForCurrentNode();
        const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
        if (picked === null)
            return plan;
        return {
            ...plan,
            primaryToken: picked,
            secondaryToken: undefined,
            confidence: plan.confidence !== undefined ? Math.min(plan.confidence, 0.32) : 0.22,
        };
    }
    /**
     * When the last four successful moves alternate between two rooms using the same primary
     * token, substitute **LOOK** so autoplay does not ping-pong forever (parser accepts the command).
     */
    avoidOscillatingCommand(plan) {
        if (plan.continuePlaying === false)
            return plan;
        const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (quit === "QUIT")
            return plan;
        const loop = detectAlternatingLocationCommandLoop(this.turns);
        if (loop === null)
            return plan;
        const p = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (p !== loop.repeatedPrimary)
            return plan;
        if (p === "LOOK" || p === "EXAMI")
            return plan;
        return {
            ...plan,
            primaryToken: "LOOK",
            secondaryToken: undefined,
            confidence: plan.confidence !== undefined ? Math.min(plan.confidence, 0.35) : 0.25,
        };
    }
    /**
     * When the location has not changed for several turns, avoid repeating the same GETIN line
     * or a motion primary already marked no-progress from this inferred cell.
     */
    avoidStagnatingCommand(plan) {
        if (plan.continuePlaying === false)
            return plan;
        const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (quit === "QUIT")
            return plan;
        if (!this.isLocationStagnating())
            return plan;
        const cmd = {
            primaryToken: plan.primaryToken,
            secondaryToken: plan.secondaryToken,
            confidence: plan.confidence,
        };
        const lineKey = normalizeGetinLineKey(interpretedToGetinLine(cmd));
        const ok = this.turns.filter((t) => !t.outcomeWasParserRejection);
        const recent = ok.slice(-3);
        const recentKeys = recent.map((t) => normalizeGetinLineKey(t.command));
        const repeatsRecentLine = recentKeys.includes(lineKey);
        const planPrimary = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        const cellKey = this.exploration.currentCellKey();
        const mapOutcome = this.exploration.getExitOutcome(cellKey, planPrimary);
        const mapSaysNoProgress = mapOutcome === "same" && !PRIMARY_IGNORE_MAP_DEAD.has(planPrimary);
        const nullKeys = this.getNullKeysForCurrentNode();
        const nullSaysNoProgress = nullKeys.has(lineKey) && !PRIMARY_IGNORE_MAP_DEAD.has(planPrimary);
        if (!repeatsRecentLine && !mapSaysNoProgress && !nullSaysNoProgress)
            return plan;
        const rejected = new Set(this.rejectedGetinQueue);
        const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
        if (picked === null)
            return plan;
        return {
            ...plan,
            primaryToken: picked,
            secondaryToken: undefined,
            confidence: plan.confidence !== undefined ? Math.min(plan.confidence, 0.3) : 0.22,
        };
    }
    /**
     * After LOOK or EXAMI once left us in the same inferred room, do not send it again from this
     * cell (runs after other guards so oscillation-forced LOOK is also subject to this rule).
     */
    avoidRepeatedLookExamiInSameCell(plan) {
        if (plan.continuePlaying === false)
            return plan;
        const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (quit === "QUIT")
            return plan;
        const planPrimary = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
        if (planPrimary !== "LOOK" && planPrimary !== "EXAMI")
            return plan;
        const outcome = this.exploration.getExitOutcome(this.exploration.currentCellKey(), planPrimary);
        if (outcome !== "same")
            return plan;
        const rejected = new Set(this.rejectedGetinQueue);
        const nullKeys = this.getNullKeysForCurrentNode();
        const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
        if (picked === null)
            return plan;
        return {
            ...plan,
            primaryToken: picked,
            secondaryToken: undefined,
            confidence: plan.confidence !== undefined ? Math.min(plan.confidence, 0.32) : 0.2,
        };
    }
    refreshDerived(text) {
        const tailForInventory = transcriptAfterLastFortranInit(text);
        const fromText = extractInventoryFromText(tailForInventory);
        const fromTurns = inferCarriedInventoryFromTurnHistory(this.turns.slice(this.inventoryTurnStart));
        this.inventory = fromText.length > 0 ? fromText : fromTurns;
        const loc = extractLocationHint(text);
        if (loc)
            this.locationHint = loc;
        this.objectNotes = extractObjectNotes(text);
        if (recentTextSuggestsIndoorBuildingNavigation(text) &&
            resolveAutoplayPromptMode() === "full") {
            this.objectNotes = [
                ...this.objectNotes,
                "Inside a building or similar: if the room lists items you are not carrying, TAKE/GET those first; then plain compass (NORTH/EAST/…) often fails until you leave — prefer OUT, BUILD, LEAVE/EXIT (or room nouns) until text describes open terrain.",
            ].slice(0, 8);
        }
    }
    buildStateBlock() {
        const lines = ["## Derived state (heuristic from recent output)"];
        lines.push(`Location hint: ${this.locationHint || "(unknown — infer from recent game text)"}`);
        if (this.inventory.length > 0) {
            lines.push(`Inventory (parsed from transcript): ${this.inventory.join("; ")}`);
        }
        else {
            lines.push("Inventory (parsed): (not detected — infer from game text)");
        }
        lines.push(`Inferred map (wrapper heuristic, not engine truth): ${this.exploration.formatPromptLines({ compact: false }).join(" ")}`);
        if (this.objectNotes.length > 0) {
            lines.push(`Notes: ${this.objectNotes.join(" ")}`);
        }
        return lines.join("\n");
    }
    /**
     * Structured dashboard for small MLX models: state first (Fortran output is source of truth).
     */
    buildAdventureStateBlock() {
        if (resolveAutoplayPromptMode() === "explore") {
            const lines = [
                "### ADVENTURE STATE",
                "(Heuristic — Fortran output is authoritative.)",
                "",
                this.buildCurrentNodeBlockMx(),
                "",
                `**Exits (session):** ${this.buildPlannerExitsLine()}`,
                `**Breadcrumb (last locations):** ${this.buildPlannerBreadcrumbLine()}`,
            ];
            if (this.objectNotes.length > 0) {
                lines.push(`**Notes:** ${this.objectNotes.join(" ")}`);
            }
            const recentCmds = this.buildRecentCommandsSummary(DASHBOARD_RECENT_COMMANDS);
            lines.push("");
            lines.push(`**Recent commands (last up to ${DASHBOARD_RECENT_COMMANDS}):** ${recentCmds}`);
            return lines.join("\n");
        }
        const lines = [
            "### ADVENTURE STATE",
            "(Heuristic from recent game text — the Fortran engine is authoritative.)",
            "",
            `**Location hint:** ${this.locationHint || "(unknown — infer from RECENT GAME OUTPUT below)"}`,
        ];
        if (this.inventory.length > 0) {
            lines.push(`**Inventory (parsed from transcript):** ${this.inventory.join("; ")}`);
        }
        else {
            lines.push("**Inventory (parsed):** (not detected — infer from game text)");
        }
        lines.push("");
        lines.push(`**Exits (session):** ${this.buildPlannerExitsLine()}`);
        lines.push(`**Breadcrumb (last locations):** ${this.buildPlannerBreadcrumbLine()}`);
        if (this.objectNotes.length > 0) {
            lines.push(`**Notes:** ${this.objectNotes.join(" ")}`);
        }
        const recentCmds = this.buildRecentCommandsSummary(DASHBOARD_RECENT_COMMANDS);
        lines.push("");
        lines.push(`**Recent commands (last up to ${DASHBOARD_RECENT_COMMANDS}):** ${recentCmds}`);
        return lines.join("\n");
    }
    buildRoomDescriptionSnippet() {
        const stripped = stripInjectedCommandLinesForObjectHints(this.recentRawTail).trim();
        if (stripped.length === 0)
            return "(none yet)";
        return oneLineExcerpt(stripped, 220);
    }
    buildItemsHereLine(options) {
        if (!this.adventureDbRef)
            return "(unknown)";
        let objs = listVisibleAdventureObjectsInText(this.adventureDbRef, this.getObjectHintScopeText());
        const takeFail = new Set(this.getRoomTakeFailureObjectAtabWords());
        objs = objs.filter((w) => !takeFail.has(w));
        if (!options?.excludeCarried || this.inventory.length === 0) {
            return objs.length > 0 ? objs.join(", ") : "(none visible)";
        }
        const carried = new Set(listVisibleAdventureObjectsInText(this.adventureDbRef, this.inventory.join("\n")));
        const rest = objs.filter((w) => !carried.has(w));
        return rest.length > 0 ? rest.join(", ") : "(none visible)";
    }
    buildPlannerExitsLine() {
        const nullKeys = this.getNullKeysForCurrentNode();
        const { travel: deadTravel } = this.exploration.partitionDeadEndPrimariesFromCurrentCell();
        const tryNext = this.exploration
            .getUntriedMotionPrimaries(nullKeys)
            .slice(0, 16);
        const parts = [];
        if (tryNext.length > 0)
            parts.push(`open: ${tryNext.join(", ")}`);
        if (deadTravel.length > 0)
            parts.push(`tried: ${deadTravel.join(", ")}`);
        return parts.length > 0 ? parts.join(" | ") : "(see CANDIDATES)";
    }
    buildPlannerBreadcrumbLine() {
        const ok = this.turns.filter((t) => !t.outcomeWasParserRejection);
        const fps = ok
            .map((t) => t.outcomeLocationFingerprint)
            .filter((f) => f.length > 0);
        const last3 = fps
            .slice(-3)
            .map((f) => (f.length > 52 ? `${f.slice(0, 51)}…` : f));
        return last3.length > 0 ? last3.join(" → ") : "(start)";
    }
    buildPlannerHistoryLine() {
        const slice = this.turns.slice(-4);
        if (slice.length === 0)
            return "(none yet)";
        return slice
            .map((t) => {
            const cmd = formatPlannerCommandAbbrev(t.command);
            if (t.outcomeWasParserRejection)
                return `${cmd} (Rejected)`;
            if (gameOutputLooksLikeBlockedMove(t.outcomeExcerpt))
                return `${cmd} (Blocked)`;
            return cmd;
        })
            .join("; ");
    }
    /** Recent primaries with compact outcome tags for SLM **Hist:** (ties to **Cand** selection). */
    buildPlannerHistoryCommaPrimaries() {
        const slice = this.turns.slice(-6);
        if (slice.length === 0)
            return "(none)";
        return slice
            .map((t) => {
            const p = getPrimaryFromStoredCommand(t.command);
            if (t.outcomeWasParserRejection)
                return `${p} (Reject)`;
            if (gameOutputLooksLikeBlockedMove(t.outcomeExcerpt))
                return `${p} (No path)`;
            return `${p} (OK)`;
        })
            .join(", ");
    }
    /** Shorter **Exits:** line: open directions comma-separated, optional tried suffix. */
    buildPlannerExitsCommaList() {
        const nullKeys = this.getNullKeysForCurrentNode();
        const { travel: deadTravel } = this.exploration.partitionDeadEndPrimariesFromCurrentCell();
        const tryNext = this.exploration
            .getUntriedMotionPrimaries(nullKeys)
            .slice(0, 20);
        if (tryNext.length === 0 && deadTravel.length === 0)
            return "(see Cand_Move)";
        const open = tryNext.join(", ");
        return deadTravel.length > 0
            ? `${open} (tried: ${deadTravel.join(", ")})`
            : open;
    }
    lastTwoBreadcrumbFingerprintsIdentical() {
        const ok = this.turns.filter((t) => !t.outcomeWasParserRejection);
        const fps = ok
            .map((t) => t.outcomeLocationFingerprint)
            .filter((f) => f.length > 0);
        if (fps.length < 2)
            return false;
        return fps[fps.length - 1] === fps[fps.length - 2];
    }
    /** Same primary repeated at least `min` times in the last up-to-five turns. */
    repeatedPrimaryStreakMin(min) {
        const slice = this.turns.slice(-5);
        if (slice.length < min)
            return null;
        const primaries = slice.map((t) => getPrimaryFromStoredCommand(t.command));
        const last = primaries[primaries.length - 1];
        if (last.length === 0)
            return null;
        const n = primaries.filter((p) => p === last).length;
        return n >= min ? last : null;
    }
    buildPlannerMxTaskLine(lootFunnel) {
        if (lootFunnel) {
            return "Ground **Items** are listed and **Inv** is empty — output **TAKE** or **GET** with **secondaryToken** from **Items**/**Cand_Obj** now. Ignore pathfinding until **Items** reads (none visible). JSON only.";
        }
        const base = "Pick one command from **Cand_Move**/**Cand_Act** not negated by **Hist**. JSON only.";
        const streak = this.repeatedPrimaryStreakMin(3);
        if (streak !== null) {
            return `Break ${streak} repetition — ${base}`;
        }
        if (this.lastTwoBreadcrumbFingerprintsIdentical()) {
            return `Last two locations match — pick a primary not shown as (No path)/(Reject) in **Hist**. ${base}`;
        }
        return base;
    }
    /**
     * Compact situation fields for MLX structured **user** prompts (no x,y,z map, no DOT).
     */
    buildPlannerMxUserCoreBlock(compact, options) {
        const lootFunnel = options?.lootFunnel === true;
        const alerts = this.buildCompactPlannerAlerts();
        const inv = this.inventory.length > 0 ? this.inventory.join(", ") : "(empty)";
        const itemsHere = this.buildItemsHereLine();
        const exits = compact
            ? this.buildPlannerExitsCommaList()
            : this.buildPlannerExitsLine();
        const exitsDisplay = compact && lootFunnel
            ? "(deferred — clear ground **Items** first)"
            : exits;
        if (compact) {
            const hist = this.buildPlannerHistoryCommaPrimaries();
            const lines = [
                `**Loc:** ${this.locationHint || "?"}`,
                `**Inv:** ${inv}`,
            ];
            if (!lootFunnel) {
                lines.push(`**Items:** ${itemsHere}`);
            }
            lines.push(`**Exits:** ${exitsDisplay}`, `**Hist:** ${hist}`);
            if (alerts.length > 0) {
                lines.push("", "**Alt:**");
                for (const a of alerts) {
                    lines.push(`- ${oneLineExcerpt(a, 160)}`);
                }
            }
            return lines.join("\n");
        }
        const crumb = this.buildPlannerBreadcrumbLine();
        const hist = this.buildPlannerHistoryLine();
        const lines = [
            `**Location:** ${this.locationHint || "(unknown)"}`,
            `**Description:** ${this.buildRoomDescriptionSnippet()}`,
            `**Inventory:** ${inv}`,
            `**Items here:** ${itemsHere}`,
            `**Exits:** ${exits}`,
            `**Breadcrumb:** ${crumb}`,
            `**History:** ${hist}`,
        ];
        if (alerts.length > 0) {
            lines.push("");
            lines.push("**Alerts:**");
            for (const a of alerts)
                lines.push(`- ${a}`);
        }
        return lines.join("\n");
    }
    buildCompactPlannerAlerts() {
        const out = [];
        const last = this.turns[this.turns.length - 1];
        if (last?.outcomeWasParserRejection) {
            out.push("The parser rejected the last command — try another verb from **Cand_Act** / **Cand_Move**, or **LOOK**/**EXAMI**, then a **new** primary (not the same GETIN).");
        }
        if (recentTextSuggestsIndoorBuildingNavigation(this.recentRawTail) &&
            resolveAutoplayPromptMode() === "full") {
            out.push("Transcript suggests you are inside a building (or a compass move just failed indoors). After **TAKE**/**GET** + object for anything you still need from **CANDIDATES** or the transcript, **OUT**, **BUILD**, **LEAVE**, and **EXIT** usually work better than compass alone until room text reads like open terrain.");
        }
        const loop = detectAlternatingLocationCommandLoop(this.turns);
        if (loop !== null) {
            const a = loop.locA.length > 40 ? `${loop.locA.slice(0, 39)}…` : loop.locA;
            const b = loop.locB.length > 40 ? `${loop.locB.slice(0, 39)}…` : loop.locB;
            out.push(`Two-location loop (${a} ↔ ${b}) with \`${loop.repeatedPrimary}\` — **prioritize** **BUILD**, **ENTER**, a fresh compass direction, or **TAKE**/**GET** on a visible object; **LOOK**/**EXAMI** when you need wording. After a room change, \`${loop.repeatedPrimary}\` may apply again.`);
        }
        if (this.rejectedGetinQueue.length > 0) {
            const slice = this.rejectedGetinQueue.slice(-8);
            const fmt = slice.map((k) => formatRejectedGetinForPrompt(k)).join("; ");
            out.push(`Parser refused these GETIN lines — **prefer a new combination** when the situation is unchanged: ${fmt}${this.rejectedGetinQueue.length > 8 ? " …" : ""}`);
        }
        if (this.isLocationStagnating()) {
            out.push(`No location change for ${STAGNATION_MIN_SAME_TURNS}+ successful moves — use **Exits** and **CANDIDATES**: compass, **UP**/**DOWN**, **ENTER**, **IN**, and verbs you have not used from this cell yet; **rotate** toward a fresh command.`);
        }
        return out;
    }
    buildRecentCommandsSummary(maxCommands) {
        if (this.turns.length === 0)
            return "(none yet)";
        const slice = this.turns.slice(-maxCommands);
        return slice
            .map((t) => `\`${t.command}\` → ${t.outcomeExcerpt}`)
            .join(" | ");
    }
    /**
     * When the last GETIN result was a parser rejection, instruct the planner explicitly.
     * Small models often repeat the same primaryToken unless this is surfaced as state.
     */
    buildParserRejectionBlock(structured) {
        const last = this.turns[this.turns.length - 1];
        if (!last?.outcomeWasParserRejection)
            return null;
        const title = structured
            ? "### Parser rejection (last turn)"
            : "## Parser rejection (last turn — first-class state)";
        return `${title}
The game did not accept the last command as written. **Next steps:**
- Issue a **new** primaryToken (different from the previous GETIN) unless the room or situation clearly changed.
- **Prefer** another verb or object from the vocabulary. Travel/motion words (e.g. **BUILD**, **ENTER**) apply in specific situations; inside a location, **TAKE** or **GET** with the object in secondaryToken when items are listed on the ground.
- **LOOK** or **EXAMI** when you need more object or room wording; otherwise pick another verb or direction from the vocabulary.`;
    }
    buildOscillationBlock(structured) {
        const loop = detectAlternatingLocationCommandLoop(this.turns);
        if (loop === null)
            return null;
        const title = structured
            ? "### Two-location loop (last 4 moves)"
            : "## Two-location loop (last 4 moves)";
        const a = loop.locA.length > 72 ? `${loop.locA.slice(0, 71)}…` : loop.locA;
        const b = loop.locB.length > 72 ? `${loop.locB.slice(0, 71)}…` : loop.locB;
        return `${title}
The last four successful moves alternated between the same two location lines using \`${loop.repeatedPrimary}\` each time:
- ${a}
- ${b}
**Prefer** a direction or noun from the room text next time: **BUILD**, **ENTER**, compass, **TAKE**/**GET** + object. **LOOK**/**EXAMI** when you need fresh wording. Re-use \`${loop.repeatedPrimary}\` after the transcript clearly shows a new situation.`;
    }
    buildStagnationBlock(structured) {
        if (!this.isLocationStagnating())
            return null;
        const title = structured
            ? "### Location stagnation"
            : "## Location stagnation (heuristic)";
        const nullKeys = this.getNullKeysForCurrentNode();
        const tryNext = this.exploration
            .getUntriedMotionPrimaries(nullKeys)
            .slice(0, 12);
        const indoor = recentTextSuggestsIndoorBuildingNavigation(this.recentRawTail);
        const hint = indoor
            ? tryNext.length > 0
                ? `If indoors, **OUT** and **BUILD** often help before more compass; map also suggests: **${tryNext.join("**, **")}** (still open from this inferred cell).`
                : "If indoors, **OUT**, **BUILD**, **LEAVE**, and **EXIT** usually beat raw compass until the room changes."
            : tryNext.length > 0
                ? `**Try next** includes: **${tryNext.join("**, **")}** (still open from this inferred cell).`
                : "Prefer a fresh compass direction, **UP**/**DOWN**, **ENTER**, or **IN** from the vocabulary.";
        return `${title}
The last ${STAGNATION_MIN_SAME_TURNS} or more successful moves share the same location line. **Rotate** toward a fresh GETIN from **Exits** / **CANDIDATES** unless the transcript changed.
${hint}
Use **INVENTORY (parsed)** for TAKE/GET/DROP when items appear in the room text.`;
    }
    /**
     * Session-learned travel edges from the current inferred cell to adjacent cells (labels capped).
     */
    buildNeighborLookaheadLines(snap, currentGraphNodeId) {
        const out = [];
        const cap = 4;
        for (const e of snap.directedEdges) {
            if (out.length >= cap)
                break;
            if (e.kind !== "move")
                continue;
            if (e.from !== currentGraphNodeId)
                continue;
            if (e.from === e.to)
                continue;
            const destLabel = graphNodeCaptionForSnapshot(snap, e.to);
            const short = destLabel.length > 56 ? `${destLabel.slice(0, 55)}…` : destLabel;
            out.push(`${e.label} → ${short}`);
        }
        return out;
    }
    /** Local affordances for the current inferred cell (explore-first prompts). */
    buildCurrentNodeBlockMx() {
        const nullKeys = this.getNullKeysForCurrentNode();
        const { travel: deadTravel, other: deadOther } = this.exploration.partitionDeadEndPrimariesFromCurrentCell();
        const tryNext = this.exploration
            .getUntriedMotionPrimaries(nullKeys)
            .slice(0, 12);
        const snap = this.exploration.toSnapshot(this.mapSnapshotOptions());
        const curId = graphNodeIdFromCellKey(this.exploration.currentCellKey());
        const lookahead = this.buildNeighborLookaheadLines(snap, curId);
        const lines = [
            "### AT THIS NODE (inferred)",
            `**Place:** ${this.locationHint || "(unknown)"}`,
            `**Carrying:** ${this.inventory.length > 0 ? this.inventory.join("; ") : "(unknown)"}`,
        ];
        if (deadTravel.length > 0) {
            lines.push(`**Explored from here (travel / exits):** ${deadTravel.join(", ")}`);
        }
        if (deadOther.length > 0) {
            lines.push(`**Explored from here (LOOK / objects / other):** ${deadOther.join(", ")}`);
        }
        if (tryNext.length > 0) {
            lines.push(`**Try next:** ${tryNext.join(", ")}`);
        }
        if (lookahead.length > 0) {
            lines.push(`**Known exits (session):** ${lookahead.join(" | ")}`);
        }
        return lines.join("\n");
    }
    /**
     * Text-only spatial hint for merged planner prompts (replaces Graphviz DOT for SLMs).
     */
    buildPlannerSpatialHintBlock() {
        return [
            "### SPATIAL HINT (session, text)",
            `**Exits:** ${this.buildPlannerExitsLine()}`,
            `**Breadcrumb:** ${this.buildPlannerBreadcrumbLine()}`,
        ].join("\n");
    }
    buildRejectedCommandsBlock(structured) {
        if (this.rejectedGetinQueue.length === 0)
            return null;
        const lines = this.rejectedGetinQueue.map((k, i) => `${i + 1}. ${formatRejectedGetinForPrompt(k)}`);
        const title = structured
            ? "### Parser-rejected commands (prefer new lines)"
            : "## Parser-rejected commands (prefer new lines)";
        return `${title}
The game already refused these GETIN lines in the current situation. **Prefer** a different 10-column GETIN line unless the transcript clearly changed.
${lines.join("\n")}`;
    }
    /**
     * Gemma-oriented planner: **system** = SLM **Rules** + JSON shape (no duplicate token list).
     * **user** = **Loc** / **Cand** / **Hist** / … + **Task**; tokens live only in **Cand** (situational list).
     * The worker merges `system` + `user` before generation (`scripts/mlx_lm_worker.py`).
     */
    buildPlannerMxStructuredPrompt(maxChars, options) {
        const mode = resolveAutoplayPromptMode();
        const compact = options.compact;
        const lootFunnelActive = compact && options.lootFunnel === true;
        const situationalSection = options.situationalSection?.trim();
        const situationalBlock = situationalSection && situationalSection.length > 0
            ? (() => {
                let body = situationalSection
                    .replace(/^## Situation candidates[^\n]*\n*/i, "")
                    .trim();
                if (compact) {
                    const hasCand = body.includes("**Cand_Move:**") ||
                        body.includes("**Cand_Act:**") ||
                        body.includes("**Cand:**");
                    if (!hasCand && body.length > 0) {
                        body = `**Cand:** ${body}`;
                    }
                }
                else if (body.length > 0 && !body.startsWith("###")) {
                    body = `### CANDIDATES\n${body}`;
                }
                return body;
            })()
            : "";
        const sessionFraming = compact
            ? "### SESSION"
            : mode === "explore"
                ? "### CURRENT SESSION\nPick **one** JSON command per system **Rules**."
                : "### CURRENT SESSION\nPick **one** parser command. No full transcript — local fields only.";
        const itemsHere = this.buildItemsHereLine(lootFunnelActive ? { excludeCarried: true } : undefined);
        const taskLine = this.buildPlannerMxTaskLine(lootFunnelActive);
        const tail = [];
        if (lootFunnelActive) {
            tail.push("", `**Items:** ${itemsHere}`, "", `**Task:** ${taskLine}`);
        }
        else {
            tail.push("", `**Task:** ${taskLine}`);
        }
        const userSections = [
            sessionFraming,
            "",
            this.buildPlannerMxUserCoreBlock(compact, {
                lootFunnel: lootFunnelActive,
            }),
            ...(situationalBlock ? ["", situationalBlock] : []),
            ...tail,
        ].join("\n");
        const user = userSections.length > maxChars
            ? trimPromptPreservePrefix(userSections, maxChars)
            : userSections;
        return {
            system: mlxAutoplaySystemPrompt(compact, mode, lootFunnelActive),
            user,
        };
    }
    /**
     * Assemble full user prompt body for the planner: narrative sections + text spatial hint,
     * trimmed to `maxChars` (no full verbatim transcript; no numbered recent-move list).
     */
    buildPlannerUserPrompt(maxChars, vocabHint, options) {
        const compact = options?.compact ?? false;
        const structured = options?.structuredDashboard ?? false;
        const situationalSection = options?.situationalSection?.trim();
        const mode = resolveAutoplayPromptMode();
        const parserBlock = this.buildParserRejectionBlock(structured);
        const oscillationBlock = this.buildOscillationBlock(structured);
        const stagnationBlock = this.buildStagnationBlock(structured);
        const rejectedBlock = this.buildRejectedCommandsBlock(structured);
        const spatialHint = this.buildPlannerSpatialHintBlock();
        const vocabSection = vocabTrim(vocabHint, maxChars);
        let preambleHead;
        if (structured) {
            const adventureState = this.buildAdventureStateBlock();
            const taskBlock = autoplayPlannerTaskBlockStructured(mode);
            preambleHead = [
                ...linesForAutoplayPlannerContextBody(vocabSection, {
                    compact,
                    structuredDashboard: true,
                    autoplayPromptMode: mode,
                }),
                "",
                adventureState,
                "",
                taskBlock,
                ...(situationalSection ? ["", situationalSection] : []),
                ...(rejectedBlock ? ["", rejectedBlock] : []),
                ...(parserBlock ? ["", parserBlock] : []),
                ...(oscillationBlock ? ["", oscillationBlock] : []),
                ...(stagnationBlock ? ["", stagnationBlock] : []),
            ].join("\n");
        }
        else {
            const stateBlock = this.buildStateBlock();
            preambleHead = [
                ...linesForAutoplayPlannerContextBody(vocabSection, {
                    compact,
                    autoplayPromptMode: mode,
                }),
                ...(situationalSection ? ["", situationalSection] : []),
                "",
                stateBlock,
                ...(rejectedBlock ? ["", rejectedBlock] : []),
                ...(parserBlock ? ["", parserBlock] : []),
                ...(oscillationBlock ? ["", oscillationBlock] : []),
                ...(stagnationBlock ? ["", stagnationBlock] : []),
            ].join("\n");
        }
        const out = `${preambleHead}\n\n${spatialHint}`;
        return out.length > maxChars
            ? trimPromptPreservePrefix(out, maxChars)
            : out;
    }
}
function vocabTrim(vocabHint, maxChars) {
    const cap = Math.min(6000, Math.max(2000, Math.floor(maxChars * 0.45)));
    if (vocabHint.length <= cap)
        return vocabHint;
    return `${vocabHint.slice(0, cap - 1)}…`;
}
function trimPromptPreservePrefix(s, maxChars) {
    if (s.length <= maxChars)
        return s;
    return `${s.slice(0, maxChars - 48)}\n…\n[truncated — tail dropped]`;
}
//# sourceMappingURL=autoplaySessionMemory.js.map