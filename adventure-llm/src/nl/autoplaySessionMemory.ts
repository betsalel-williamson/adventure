/**
 * In-process session memory for self-acting (autoplay) mode: event log, heuristic
 * derived state, and budgeted prompt text for stateless TextLlm calls.
 * MLX structured prompts: {@link mlxAutoplaySystemPrompt} (system) + situational user body in `buildPlannerMxStructuredPrompt`.
 * Shared role/rules for other paths: {@link linesForAutoplayPlannerContextBody}.
 */
import {
  autoplayPlannerTaskBlockStructured,
  linesForAutoplayPlannerContextBody,
  mlxAutoplaySystemPrompt,
  resolveAutoplayPromptMode,
} from "./adventureNlPrompts.js";
import type { AdventureDatabase } from "../dat/types.js";
import {
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
  listVisibleAdventureObjectsInText,
  matchSecondaryToObjectAtabWord,
  recentTextSuggestsIndoorBuildingNavigation,
} from "./situationalCandidates.js";
import {
  interpretedToGetinLine,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "./schema.js";
import {
  detectLocationStagnation,
  fingerprintLocationFromGameOutput,
  graphNodeIdFromCellKey,
  locationFingerprintFromGameOutputStrict,
  InferredExplorationMap,
  type InferredExplorationMapSnapshot,
} from "./inferredExplorationMap.js";
import {
  graphNodeCaptionForSnapshot,
  inferredMapToDot,
  inferredMapToLocalDot,
  inferredMapToMermaid,
} from "./explorationGraphViz.js";

const MAX_INTERNAL_RAW = 48_000;
/** Cap "recent command" lines in structured dashboard (RTFM: keep history short). */
const DASHBOARD_RECENT_COMMANDS = 8;
const ONE_LINE_OUTCOME_MAX = 160;
/** Max GETIN lines remembered as parser-rejected (FIFO, deduped). */
const MAX_REJECTED_GETIN_QUEUE = 32;
/** Successive non-rejection turns with the same location fingerprint → stagnation. */
const STAGNATION_MIN_SAME_TURNS = 3;

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
export function gameOutputLooksLikeParserRejection(text: string): boolean {
  const u = text.toUpperCase();
  return (
    u.includes("I DON'T KNOW HOW TO APPLY THAT WORD HERE") ||
    u.includes("I DON'T UNDERSTAND THAT") ||
    u.includes("I DON'T KNOW THAT WORD") ||
    u.includes("I DON'T KNOW IN FROM OUT HERE") ||
    u.includes("I DON'T KNOW HOW TO LOCK OR UNLOCK SUCH A THING") ||
    u.includes("NOTHING HAPPENS")
  );
}

/** True when movement in a compass direction was refused (room unchanged). */
export function gameOutputLooksLikeBlockedMove(text: string): boolean {
  const u = text.toUpperCase();
  return u.includes("THERE IS NO WAY TO GO THAT DIRECTION");
}

/**
 * True when the engine is asking whether to restart after death (e.g. LTEXT 81: PLAY AGAIN?).
 * The stock YES() routine treats any GETIN primary other than N / NO as affirmative.
 */
export function gameOutputLooksLikePlayAgainPrompt(text: string): boolean {
  const u = text.toUpperCase();
  return u.includes("GAME IS OVER") && u.includes("PLAY AGAIN");
}

/**
 * Canonical 10-character GETIN key (two five-letter columns, space-padded) for comparing lines.
 */
export function normalizeGetinLineKey(line: string): string {
  const t = line.replace(/\r/g, "").toUpperCase().trim();
  const head = (t.length >= 10 ? t.slice(0, 10) : t.padEnd(10, " ")).slice(
    0,
    10,
  );
  const primary = head.slice(0, 5).trimEnd().padEnd(5, " ");
  const secondary = head.slice(5, 10).trimEnd().padEnd(5, " ");
  return `${primary}${secondary}`;
}

function formatRejectedGetinForPrompt(key: string): string {
  const p = key.slice(0, 5).trimEnd();
  const s = key.slice(5, 10).trimEnd();
  if (s.length === 0) return `\`${p}\` (primary only)`;
  return `\`${p}\` + \`${s}\``;
}

const ESCAPE_PRIMARY_TOKENS: readonly string[] = [
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

function oneLineExcerpt(text: string, maxLen: number): string {
  const t = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function getPrimaryFromStoredCommand(command: string): string {
  const t = command.replace(/\r/g, "").trimEnd().toUpperCase();
  const head = (t.length >= 5 ? t.slice(0, 5) : t.padEnd(5, " ")).slice(0, 5);
  return head.trimEnd();
}

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
export function detectAlternatingLocationCommandLoop(
  turns: readonly AutoplayTurnRecord[],
): AlternatingLocationLoopInfo | null {
  const ok = turns.filter((t) => !t.outcomeWasParserRejection);
  if (ok.length < 4) return null;
  const last4 = ok.slice(-4);
  const fp = last4.map((t) => t.outcomeLocationFingerprint);
  const primaries = last4.map((t) => getPrimaryFromStoredCommand(t.command));
  if (fp[0] !== fp[2] || fp[1] !== fp[3]) return null;
  if (fp[0] === fp[1]) return null;
  if (
    primaries[0] !== primaries[1] ||
    primaries[0] !== primaries[2] ||
    primaries[0] !== primaries[3]
  ) {
    return null;
  }
  return {
    repeatedPrimary: primaries[0]!,
    locA: fp[0]!,
    locB: fp[1]!,
  };
}

/**
 * After death + "play again", Fortran jumps to label 1100 and prints `INIT DONE`
 * before re-seeding the world. Inventory heuristics must ignore transcript and
 * TAKE history from before that point.
 */
function transcriptAfterLastFortranInit(text: string): string {
  const lower = text.toLowerCase();
  const marker = "init done";
  const idx = lower.lastIndexOf(marker);
  if (idx < 0) return text;
  return text.slice(idx + marker.length).replace(/^[\s\r\n]*/, "");
}

function extractInventoryFromText(text: string): string[] {
  const u = text.toUpperCase();
  const out: string[] = [];
  const carryingIdx = u.lastIndexOf("YOU ARE CARRYING");
  if (carryingIdx >= 0) {
    const slice = text.slice(carryingIdx);
    const lines = slice.split(/\n/).slice(0, 8);
    for (const line of lines) {
      const t = line.trim();
      if (t.length === 0) continue;
      if (/^YOU ARE CARRYING/i.test(t)) continue;
      if (/^YOU ARE (NOT|EMPTY|IN )/i.test(t)) break;
      if (/^YOU (CAN|DON'T|SEE|ARE|HAVE)/i.test(t) && out.length > 0) break;
      if (/^>/m.test(t)) break;
      if (t.length > 2) out.push(t.slice(0, 80));
    }
  }
  if (out.length === 0) {
    const m = u.match(/\bNOW CARRYING\b[^.\n]*([^\n]+)/i);
    if (m?.[1]) out.push(m[1].trim().slice(0, 80));
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

function parseGetinPrimarySecondary(command: string): {
  primary: string;
  secondary: string;
} {
  const t = command.replace(/\r/g, "").trim();
  const upper = t.toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0]!.length > 5) {
    const w = words[0]!;
    return {
      primary: w.slice(0, 5).trimEnd(),
      secondary: w.slice(5, 10).trimEnd(),
    };
  }
  if (words.length >= 2) {
    const primary = words[0]!.slice(0, 5).trimEnd();
    const takeOrDrop =
      INVENTORY_TAKE_VERB_PRIMARIES.has(primary) ||
      INVENTORY_DROP_VERB_PRIMARIES.has(primary);
    if (words.length >= 3 && takeOrDrop) {
      return {
        primary,
        secondary: words[words.length - 1]!.slice(0, 5).trimEnd(),
      };
    }
    return {
      primary,
      secondary: words[1]!.slice(0, 5).trimEnd(),
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
function formatPlayerCommandLineForTranscript(command: string): string {
  const { primary, secondary } = parseGetinPrimarySecondary(command);
  const p = primary.trim();
  const s = secondary.trim();
  if (!p) return "";
  if (!s) return `> ${p}`;
  return `> ${p} ${s}`;
}

/**
 * True when Fortran likely printed SPEAK(54) ("OK") for a successful take/drop.
 * The stock engine does not list inventory after TAKE; it only prints OK.
 */
function outcomeLooksLikeFortranOkSuccess(gameOutput: string): boolean {
  if (gameOutputLooksLikeParserRejection(gameOutput)) return false;
  const n = gameOutput.replace(/\r\n/g, "\n").trim();
  if (n.length === 0) return false;
  const u = n.toUpperCase();
  if (u.includes("I SEE NO")) return false;
  if (u.includes("YOU AREN'T CARRYING")) return false;
  if (u.includes("YOU ARE ALREADY CARRYING")) return false;
  if (u.includes("I DON'T KNOW")) return false;
  if (u.includes("YOU CAN'T")) return false;
  if (u.includes("NOTHING HAPPENS")) return false;
  const lines = n
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const scan = Math.min(lines.length, 80);
  for (let i = 0; i < scan; i++) {
    const line = lines[i]!.toUpperCase();
    if (
      line === "OK" ||
      line.startsWith("OK ") ||
      line.startsWith("OK.") ||
      line.startsWith("OK,")
    ) {
      return true;
    }
  }
  return false;
}

function inferCarriedInventoryFromTurnHistory(
  turns: readonly AutoplayTurnRecord[],
): string[] {
  const carried: string[] = [];
  for (const t of turns) {
    if (t.outcomeWasParserRejection || !t.outcomeHadFortranOk) continue;
    const { primary, secondary } = parseGetinPrimarySecondary(t.command);
    if (!secondary) continue;
    const obj = secondary.toUpperCase();
    if (INVENTORY_TAKE_VERB_PRIMARIES.has(primary)) {
      if (!carried.includes(obj)) carried.push(obj);
    } else if (INVENTORY_DROP_VERB_PRIMARIES.has(primary)) {
      const ix = carried.indexOf(obj);
      if (ix >= 0) carried.splice(ix, 1);
    }
  }
  return carried.slice(0, 12);
}

/**
 * True for a line that looks like the engine’s room description (not inventory / carrying).
 * Align with non-place lines in {@link inferredExplorationMap} so “already carrying” never becomes Location.
 */
function lineLooksLikeGameLocationLine(line: string): boolean {
  const u = line.trim().toUpperCase();
  if (u.length === 0) return false;
  if (u.startsWith("YOU ARE CARRYING")) return false;
  if (u.includes("YOU ARE CARRYING:")) return false;
  if (
    u.includes("YOU ARE ALREADY CARRYING") ||
    u.includes("YOU'RE ALREADY CARRYING")
  )
    return false;
  if (u.includes("ALREADY CARRYING")) return false;
  if (u.startsWith("YOU ARE") || u.startsWith("YOU'RE")) return true;
  if (
    u.includes("END OF A ROAD") ||
    u.includes("WELL HOUSE") ||
    u.includes("IN A VALLEY")
  ) {
    return true;
  }
  return false;
}

/**
 * Latest room line in the transcript tail — scan **bottom-up** so the opening message does not
 * win forever once the player has moved (e.g. YOU'RE AT END OF ROAD AGAIN).
 */
function extractLocationHint(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim();
    if (lineLooksLikeGameLocationLine(t)) {
      return t.slice(0, 200);
    }
  }
  return "";
}

function extractObjectNotes(text: string): string[] {
  const u = text.toUpperCase();
  const notes: string[] = [];
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
const PRIMARY_IGNORE_MAP_DEAD: ReadonlySet<string> = new Set([
  "DROP",
  "OPEN",
  "LOCK",
  "KILL",
  "FEED",
  "INVE",
]);

function inventorySignature(items: readonly string[]): string {
  return [...items]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

export class AutoplaySessionMemory {
  private recentRawTail = "";
  private turns: AutoplayTurnRecord[] = [];
  /**
   * Only turns from this index onward contribute to {@link inferCarriedInventoryFromTurnHistory}.
   * Advanced when Fortran prints INIT DONE (full game re-init after restart).
   */
  private inventoryTurnStart = 0;
  /** Structured inventory lines parsed from the transcript (Fortran text is authoritative). */
  private inventory: string[] = [];
  private locationHint = "";
  private objectNotes: string[] = [];
  /** FIFO of GETIN keys the parser rejected; cleared after any non-rejection outcome. */
  private rejectedGetinQueue: string[] = [];
  private readonly exploration = new InferredExplorationMap();
  /** Set when {@link recordCommandOutcome} or {@link seedOpening} receives `adventureDb`. */
  private adventureDbRef: AdventureDatabase | undefined;
  /** graphNodeId → GETIN keys that were NULL (no location or inventory change). */
  private readonly nullCommandKeysByNode = new Map<string, Set<string>>();

  /** ATAB object words from parsed inventory — subtract from room “takeable” on the map. */
  private inventoryObjectAtabWordsForMap(): ReadonlySet<string> | undefined {
    if (!this.adventureDbRef || this.inventory.length === 0) return undefined;
    return new Set(
      listVisibleAdventureObjectsInText(
        this.adventureDbRef,
        this.inventory.join("\n"),
      ),
    );
  }

  private mapSnapshotOptions(): {
    inventoryObjectAtabWords?: ReadonlySet<string>;
  } {
    const inv = this.inventoryObjectAtabWordsForMap();
    return inv ? { inventoryObjectAtabWords: inv } : {};
  }

  /**
   * Raw accumulated transcript tail (for situational candidate extraction).
   * After each {@link recordCommandOutcome}, a line `> VERB` or `> VERB OBJECT` is
   * inserted immediately before that turn's engine output.
   */
  getRecentRawTail(): string {
    return this.recentRawTail;
  }

  /** Seed from transcript before the first `> ` command. */
  seedOpening(
    transcript: string,
    options?: { readonly adventureDb?: AdventureDatabase },
  ): void {
    if (options?.adventureDb) this.adventureDbRef = options.adventureDb;
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
  getStructuredInventory(): readonly string[] {
    return this.inventory;
  }

  /** Heuristic location line parsed from recent transcript (may be empty). */
  getLocationHint(): string {
    return this.locationHint;
  }

  /**
   * Snapshot of heuristic state for dashboards: inferred map, inventory hints, recent moves.
   */
  buildAutoplayUiSnapshot(): AutoplayUiSnapshot {
    const recentTurns: AutoplayUiTurnSnapshot[] = this.turns
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
  isLocationStagnating(): boolean {
    return detectLocationStagnation(this.turns, STAGNATION_MIN_SAME_TURNS);
  }

  /** One line for situational CANDIDATES when stagnating (inferred map). */
  formatExplorationTryNextLine(): string {
    const nullKeys = this.getNullKeysForCurrentNode();
    const next = this.exploration
      .getUntriedMotionPrimaries(nullKeys)
      .slice(0, 10);
    if (next.length === 0) return "";
    return `**Try next (inferred map, not engine truth):** ${next.join(", ")}`;
  }

  private getNullKeysForCurrentNode(): ReadonlySet<string> {
    const id = graphNodeIdFromCellKey(this.exploration.currentCellKey());
    return new Set(this.nullCommandKeysByNode.get(id) ?? []);
  }

  private addNullCommandForNode(nodeId: string, lineKey: string): void {
    let s = this.nullCommandKeysByNode.get(nodeId);
    if (!s) {
      s = new Set();
      this.nullCommandKeysByNode.set(nodeId, s);
    }
    s.add(lineKey);
  }

  buildInteractiveInterpretPrefix(
    db: AdventureDatabase,
    options: { readonly compact: boolean },
  ): string {
    const maxTotal = options.compact ? 900 : 1400;
    const mapLine = this.exploration
      .formatPromptLines({ compact: options.compact })
      .join(" ");
    const lines: string[] = [
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
    const indoor = recentTextSuggestsIndoorBuildingNavigation(
      this.recentRawTail,
    );
    const invLines = this.getStructuredInventory();
    const situ = formatSituationalCandidatesSection(
      db,
      buildSituationalCandidateTokens(db, this.recentRawTail, {
        indoorLeaveBuilding: indoor,
        exploreFirst: resolveAutoplayPromptMode() === "explore",
        inventorySubtractText:
          invLines.length > 0 ? invLines.join("\n") : undefined,
      }),
    );
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
  recordCommandOutcome(
    command: string,
    gameOutput: string,
    options?: { readonly adventureDb?: AdventureDatabase },
  ): void {
    if (options?.adventureDb) this.adventureDbRef = options.adventureDb;
    const norm = gameOutput.replace(/\r\n/g, "\n");
    const invBefore = inventorySignature(this.inventory);
    const fpBefore = this.exploration.getLastFingerprint();
    const nodeIdBefore = graphNodeIdFromCellKey(
      this.exploration.currentCellKey(),
    );
    const outcomeWasParserRejection = gameOutputLooksLikeParserRejection(norm);
    const outcomeWasBlockedMove = gameOutputLooksLikeBlockedMove(norm);
    const outcomeLocationFingerprint =
      locationFingerprintFromGameOutputStrict(norm) ??
      fpBefore ??
      fingerprintLocationFromGameOutput(norm);
    const outcomeHadFortranOk = outcomeLooksLikeFortranOkSuccess(norm);
    if (outcomeWasParserRejection) {
      const key = normalizeGetinLineKey(command);
      if (!this.rejectedGetinQueue.includes(key)) {
        this.rejectedGetinQueue.push(key);
        while (this.rejectedGetinQueue.length > MAX_REJECTED_GETIN_QUEUE) {
          this.rejectedGetinQueue.shift();
        }
      }
    } else {
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
    }
    const cmdLine = formatPlayerCommandLineForTranscript(command);
    const withCommand = cmdLine.length > 0 ? `${cmdLine}\n${norm}` : norm;
    this.recentRawTail = (this.recentRawTail + withCommand).slice(
      -MAX_INTERNAL_RAW,
    );
    this.refreshDerived(this.recentRawTail);
    this.exploration.recordOutcome(
      command.trimEnd().slice(0, 24),
      norm,
      outcomeWasParserRejection,
      outcomeWasBlockedMove,
      {
        ...options,
        outcomeHadFortranOk: outcomeLooksLikeFortranOkSuccess(norm),
      },
    );

    const cmdKey = normalizeGetinLineKey(command.trimEnd().slice(0, 24));
    if (outcomeWasParserRejection) {
      this.addNullCommandForNode(nodeIdBefore, cmdKey);
    } else {
      const invAfter = inventorySignature(this.inventory);
      const fpAfter =
        locationFingerprintFromGameOutputStrict(norm) ??
        fpBefore ??
        fingerprintLocationFromGameOutput(norm);
      if (fpBefore !== null && fpBefore === fpAfter && invBefore === invAfter) {
        this.addNullCommandForNode(nodeIdBefore, cmdKey);
      }
    }
  }

  /**
   * If the planner's GETIN line matches a recently parser-rejected line, substitute a safe
   * one-word command not in the rejection queue (deterministic escape hatch).
   */
  avoidRepeatingRejectedCommand(
    plan: AutoplayPlannerResponse,
  ): AutoplayPlannerResponse {
    if (plan.continuePlaying === false) return plan;
    const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (quit === "QUIT") return plan;

    const cmd: InterpretedCommand = {
      primaryToken: plan.primaryToken,
      secondaryToken: plan.secondaryToken,
      confidence: plan.confidence,
    };
    const lineKey = normalizeGetinLineKey(interpretedToGetinLine(cmd));
    if (!this.rejectedGetinQueue.includes(lineKey)) return plan;

    for (const primaryToken of ESCAPE_PRIMARY_TOKENS) {
      const candidate: InterpretedCommand = { primaryToken };
      const k = normalizeGetinLineKey(interpretedToGetinLine(candidate));
      if (!this.rejectedGetinQueue.includes(k)) {
        return {
          ...plan,
          primaryToken,
          secondaryToken: undefined,
          confidence:
            plan.confidence !== undefined
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
  avoidRedundantTakeWhenCarrying(
    plan: AutoplayPlannerResponse,
  ): AutoplayPlannerResponse {
    if (plan.continuePlaying === false) return plan;
    const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (quit === "QUIT") return plan;
    const p = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (p !== "TAKE" && p !== "GET") return plan;
    const sec = plan.secondaryToken?.trim();
    if (!sec || !this.adventureDbRef) return plan;
    const matched = matchSecondaryToObjectAtabWord(sec, this.adventureDbRef);
    if (!matched) return plan;
    const carried = this.inventoryObjectAtabWordsForMap();
    if (!carried?.has(matched)) return plan;

    const rejected = new Set(this.rejectedGetinQueue);
    const nullKeys = this.getNullKeysForCurrentNode();
    const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
    if (picked === null) return plan;

    return {
      ...plan,
      primaryToken: picked,
      secondaryToken: undefined,
      confidence:
        plan.confidence !== undefined ? Math.min(plan.confidence, 0.32) : 0.22,
    };
  }

  /**
   * When the last four successful moves alternate between two rooms using the same primary
   * token, substitute **LOOK** so autoplay does not ping-pong forever (parser accepts the command).
   */
  avoidOscillatingCommand(
    plan: AutoplayPlannerResponse,
  ): AutoplayPlannerResponse {
    if (plan.continuePlaying === false) return plan;
    const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (quit === "QUIT") return plan;

    const loop = detectAlternatingLocationCommandLoop(this.turns);
    if (loop === null) return plan;

    const p = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (p !== loop.repeatedPrimary) return plan;
    if (p === "LOOK" || p === "EXAMI") return plan;

    return {
      ...plan,
      primaryToken: "LOOK",
      secondaryToken: undefined,
      confidence:
        plan.confidence !== undefined ? Math.min(plan.confidence, 0.35) : 0.25,
    };
  }

  /**
   * When the location has not changed for several turns, avoid repeating the same GETIN line
   * or a motion primary already marked no-progress from this inferred cell.
   */
  avoidStagnatingCommand(
    plan: AutoplayPlannerResponse,
  ): AutoplayPlannerResponse {
    if (plan.continuePlaying === false) return plan;
    const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (quit === "QUIT") return plan;
    if (!this.isLocationStagnating()) return plan;

    const cmd: InterpretedCommand = {
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
    const mapSaysNoProgress =
      mapOutcome === "same" && !PRIMARY_IGNORE_MAP_DEAD.has(planPrimary);
    const nullKeys = this.getNullKeysForCurrentNode();
    const nullSaysNoProgress =
      nullKeys.has(lineKey) && !PRIMARY_IGNORE_MAP_DEAD.has(planPrimary);

    if (!repeatsRecentLine && !mapSaysNoProgress && !nullSaysNoProgress)
      return plan;

    const rejected = new Set(this.rejectedGetinQueue);
    const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
    if (picked === null) return plan;

    return {
      ...plan,
      primaryToken: picked,
      secondaryToken: undefined,
      confidence:
        plan.confidence !== undefined ? Math.min(plan.confidence, 0.3) : 0.22,
    };
  }

  /**
   * After LOOK or EXAMI once left us in the same inferred room, do not send it again from this
   * cell (runs after other guards so oscillation-forced LOOK is also subject to this rule).
   */
  avoidRepeatedLookExamiInSameCell(
    plan: AutoplayPlannerResponse,
  ): AutoplayPlannerResponse {
    if (plan.continuePlaying === false) return plan;
    const quit = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (quit === "QUIT") return plan;

    const planPrimary = plan.primaryToken.toUpperCase().slice(0, 5).trimEnd();
    if (planPrimary !== "LOOK" && planPrimary !== "EXAMI") return plan;

    const outcome = this.exploration.getExitOutcome(
      this.exploration.currentCellKey(),
      planPrimary,
    );
    if (outcome !== "same") return plan;

    const rejected = new Set(this.rejectedGetinQueue);
    const nullKeys = this.getNullKeysForCurrentNode();
    const picked = this.exploration.pickEscapePrimary(rejected, nullKeys);
    if (picked === null) return plan;

    return {
      ...plan,
      primaryToken: picked,
      secondaryToken: undefined,
      confidence:
        plan.confidence !== undefined ? Math.min(plan.confidence, 0.32) : 0.2,
    };
  }

  private refreshDerived(text: string): void {
    const tailForInventory = transcriptAfterLastFortranInit(text);
    const fromText = extractInventoryFromText(tailForInventory);
    const fromTurns = inferCarriedInventoryFromTurnHistory(
      this.turns.slice(this.inventoryTurnStart),
    );
    this.inventory = fromText.length > 0 ? fromText : fromTurns;
    const loc = extractLocationHint(text);
    if (loc) this.locationHint = loc;
    this.objectNotes = extractObjectNotes(text);
    if (
      recentTextSuggestsIndoorBuildingNavigation(text) &&
      resolveAutoplayPromptMode() === "full"
    ) {
      this.objectNotes = [
        ...this.objectNotes,
        "Inside a building or similar: if the room lists items you are not carrying, TAKE/GET those first; then plain compass (NORTH/EAST/…) often fails until you leave — prefer OUT, BUILD, LEAVE/EXIT (or room nouns) until text describes open terrain.",
      ].slice(0, 8);
    }
  }

  private buildStateBlock(): string {
    const lines: string[] = ["## Derived state (heuristic from recent output)"];
    lines.push(
      `Location hint: ${this.locationHint || "(unknown — infer from recent game text)"}`,
    );
    if (this.inventory.length > 0) {
      lines.push(
        `Inventory (parsed from transcript): ${this.inventory.join("; ")}`,
      );
    } else {
      lines.push("Inventory (parsed): (not detected — infer from game text)");
    }
    lines.push(
      `Inferred map (wrapper heuristic, not engine truth): ${this.exploration.formatPromptLines({ compact: false }).join(" ")}`,
    );
    if (this.objectNotes.length > 0) {
      lines.push(`Notes: ${this.objectNotes.join(" ")}`);
    }
    return lines.join("\n");
  }

  /**
   * Structured dashboard for small MLX models: state first (Fortran output is source of truth).
   */
  private buildAdventureStateBlock(): string {
    if (resolveAutoplayPromptMode() === "explore") {
      const lines: string[] = [
        "### ADVENTURE STATE",
        "(Heuristic — Fortran output is authoritative.)",
        "",
        this.buildCurrentNodeBlockMx(),
        "",
        "**Inferred exploration map** (East=+x, North=+y, Up=+z):",
      ];
      for (const ln of this.exploration.formatPromptLines({ compact: true })) {
        lines.push(`- ${ln}`);
      }
      if (this.objectNotes.length > 0) {
        lines.push(`**Notes:** ${this.objectNotes.join(" ")}`);
      }
      const recentCmds = this.buildRecentCommandsSummary(
        DASHBOARD_RECENT_COMMANDS,
      );
      lines.push("");
      lines.push(
        `**Recent commands (last up to ${DASHBOARD_RECENT_COMMANDS}):** ${recentCmds}`,
      );
      return lines.join("\n");
    }
    const lines: string[] = [
      "### ADVENTURE STATE",
      "(Heuristic from recent game text — the Fortran engine is authoritative.)",
      "",
      `**Location hint:** ${this.locationHint || "(unknown — infer from RECENT GAME OUTPUT below)"}`,
    ];
    if (this.inventory.length > 0) {
      lines.push(
        `**Inventory (parsed from transcript):** ${this.inventory.join("; ")}`,
      );
    } else {
      lines.push(
        "**Inventory (parsed):** (not detected — infer from game text)",
      );
    }
    lines.push("");
    lines.push("**Inferred exploration map** (East=+x, North=+y, Up=+z):");
    for (const ln of this.exploration.formatPromptLines({ compact: true })) {
      lines.push(`- ${ln}`);
    }
    if (this.objectNotes.length > 0) {
      lines.push(`**Notes:** ${this.objectNotes.join(" ")}`);
    }
    const recentCmds = this.buildRecentCommandsSummary(
      DASHBOARD_RECENT_COMMANDS,
    );
    lines.push("");
    lines.push(
      `**Recent commands (last up to ${DASHBOARD_RECENT_COMMANDS}):** ${recentCmds}`,
    );
    return lines.join("\n");
  }

  /**
   * Single engine-state block for MLX: location/inventory plus optional **Alerts**
   * (parser rejection, two-room loop, queued rejected GETIN lines).
   */
  private buildGameEngineStateBlockMx(): string {
    const alerts = this.buildCompactPlannerAlerts();
    if (resolveAutoplayPromptMode() === "explore") {
      const lines: string[] = [
        "### EXPLORATION MAP (inferred — engine text is authoritative)",
      ];
      for (const ln of this.exploration.formatPromptLines({ compact: true })) {
        lines.push(ln);
      }
      if (this.objectNotes.length > 0) {
        lines.push(`Notes: ${this.objectNotes.join(" ")}`);
      }
      if (alerts.length > 0) {
        lines.push("");
        lines.push("Alerts:");
        for (const a of alerts) lines.push(`- ${a}`);
      }
      return lines.join("\n");
    }
    const loc =
      this.locationHint ||
      "(unknown — infer from Location hint and parsed state below)";
    const inv =
      this.inventory.length > 0
        ? this.inventory.join("; ")
        : "(not detected — infer from inventory lines in parsed state if any)";
    const lines: string[] = [
      "### GAME ENGINE STATE",
      `Location: ${loc}`,
      `Inventory (parsed): ${inv}`,
    ];
    lines.push("");
    lines.push("### EXPLORATION MAP (inferred — engine text is authoritative)");
    for (const ln of this.exploration.formatPromptLines({ compact: true })) {
      lines.push(ln);
    }
    if (this.objectNotes.length > 0) {
      lines.push(`Notes: ${this.objectNotes.join(" ")}`);
    }
    if (alerts.length > 0) {
      lines.push("");
      lines.push("Alerts:");
      for (const a of alerts) lines.push(`- ${a}`);
    }
    return lines.join("\n");
  }

  private buildCompactPlannerAlerts(): string[] {
    const out: string[] = [];
    const last = this.turns[this.turns.length - 1];
    if (last?.outcomeWasParserRejection) {
      out.push(
        "The parser rejected the last command — try another verb from **CANDIDATES**, or **LOOK**/**EXAMI** for room wording, then issue a **new** primaryToken (different from the previous GETIN).",
      );
    }
    if (
      recentTextSuggestsIndoorBuildingNavigation(this.recentRawTail) &&
      resolveAutoplayPromptMode() === "full"
    ) {
      out.push(
        "Transcript suggests you are inside a building (or a compass move just failed indoors). After **TAKE**/**GET** + object for anything you still need from **CANDIDATES** or the transcript, **OUT**, **BUILD**, **LEAVE**, and **EXIT** usually work better than compass alone until room text reads like open terrain.",
      );
    }
    const loop = detectAlternatingLocationCommandLoop(this.turns);
    if (loop !== null) {
      const a =
        loop.locA.length > 40 ? `${loop.locA.slice(0, 39)}…` : loop.locA;
      const b =
        loop.locB.length > 40 ? `${loop.locB.slice(0, 39)}…` : loop.locB;
      out.push(
        `Two-location loop (${a} ↔ ${b}) with \`${loop.repeatedPrimary}\` — **prioritize** **BUILD**, **ENTER**, a fresh compass direction, or **TAKE**/**GET** on a visible object; **LOOK**/**EXAMI** when you need wording. After a room change, \`${loop.repeatedPrimary}\` may apply again.`,
      );
    }
    if (this.rejectedGetinQueue.length > 0) {
      const slice = this.rejectedGetinQueue.slice(-8);
      const fmt = slice.map((k) => formatRejectedGetinForPrompt(k)).join("; ");
      out.push(
        `Parser refused these GETIN lines — **prefer a new combination** when the situation is unchanged: ${fmt}${
          this.rejectedGetinQueue.length > 8 ? " …" : ""
        }`,
      );
    }
    if (this.isLocationStagnating()) {
      out.push(
        `No location change for ${STAGNATION_MIN_SAME_TURNS}+ successful moves — use **EXPLORATION MAP** and **Try next**: compass, **UP**/**DOWN**, **ENTER**, **IN**, and verbs you have not used from this cell yet; **rotate** toward a fresh command from those lists.`,
      );
    }
    return out;
  }

  private buildRecentCommandsSummary(maxCommands: number): string {
    if (this.turns.length === 0) return "(none yet)";
    const slice = this.turns.slice(-maxCommands);
    return slice
      .map((t) => `\`${t.command}\` → ${t.outcomeExcerpt}`)
      .join(" | ");
  }

  /**
   * When the last GETIN result was a parser rejection, instruct the planner explicitly.
   * Small models often repeat the same primaryToken unless this is surfaced as state.
   */
  private buildParserRejectionBlock(structured: boolean): string | null {
    const last = this.turns[this.turns.length - 1];
    if (!last?.outcomeWasParserRejection) return null;
    const title = structured
      ? "### Parser rejection (last turn)"
      : "## Parser rejection (last turn — first-class state)";
    return `${title}
The game did not accept the last command as written. **Next steps:**
- Issue a **new** primaryToken (different from the previous GETIN) unless the room or situation clearly changed.
- **Prefer** another verb or object from the vocabulary. Travel/motion words (e.g. **BUILD**, **ENTER**) apply in specific situations; inside a location, **TAKE** or **GET** with the object in secondaryToken when items are listed on the ground.
- **LOOK** or **EXAMI** when you need more object or room wording; otherwise pick another verb or direction from the vocabulary.`;
  }

  private buildOscillationBlock(structured: boolean): string | null {
    const loop = detectAlternatingLocationCommandLoop(this.turns);
    if (loop === null) return null;
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

  private buildStagnationBlock(structured: boolean): string | null {
    if (!this.isLocationStagnating()) return null;
    const title = structured
      ? "### Location stagnation"
      : "## Location stagnation (heuristic)";
    const tryNext = this.exploration.getUntriedMotionPrimaries().slice(0, 12);
    const indoor = recentTextSuggestsIndoorBuildingNavigation(
      this.recentRawTail,
    );
    const hint = indoor
      ? tryNext.length > 0
        ? `If indoors, **OUT** and **BUILD** often help before more compass; map also suggests: **${tryNext.join("**, **")}** (still open from this inferred cell).`
        : "If indoors, **OUT**, **BUILD**, **LEAVE**, and **EXIT** usually beat raw compass until the room changes."
      : tryNext.length > 0
        ? `**Try next** includes: **${tryNext.join("**, **")}** (still open from this inferred cell).`
        : "Prefer a fresh compass direction, **UP**/**DOWN**, **ENTER**, or **IN** from the vocabulary.";
    return `${title}
The last ${STAGNATION_MIN_SAME_TURNS} or more successful moves share the same location line. **Rotate** toward a fresh GETIN from **Try next** / **EXPLORATION MAP** unless the transcript changed.
${hint}
Use **INVENTORY (parsed)** for TAKE/GET/DROP when items appear in the room text.`;
  }

  /**
   * Session-learned travel edges from the current inferred cell to adjacent cells (labels capped).
   */
  private buildNeighborLookaheadLines(
    snap: InferredExplorationMapSnapshot,
    currentGraphNodeId: string,
  ): string[] {
    const out: string[] = [];
    const cap = 4;
    for (const e of snap.directedEdges) {
      if (out.length >= cap) break;
      if (e.kind !== "move") continue;
      if (e.from !== currentGraphNodeId) continue;
      if (e.from === e.to) continue;
      const destLabel = graphNodeCaptionForSnapshot(snap, e.to);
      const short =
        destLabel.length > 56 ? `${destLabel.slice(0, 55)}…` : destLabel;
      out.push(`${e.label} → ${short}`);
    }
    return out;
  }

  /** Local affordances for the current inferred cell (explore-first prompts). */
  private buildCurrentNodeBlockMx(): string {
    const nullKeys = this.getNullKeysForCurrentNode();
    const { travel: deadTravel, other: deadOther } =
      this.exploration.partitionDeadEndPrimariesFromCurrentCell();
    const tryNext = this.exploration
      .getUntriedMotionPrimaries(nullKeys)
      .slice(0, 12);
    const snap = this.exploration.toSnapshot(this.mapSnapshotOptions());
    const curId = graphNodeIdFromCellKey(this.exploration.currentCellKey());
    const lookahead = this.buildNeighborLookaheadLines(snap, curId);
    const lines: string[] = [
      "### AT THIS NODE (inferred)",
      `**Place:** ${this.locationHint || "(unknown)"}`,
      `**Carrying:** ${this.inventory.length > 0 ? this.inventory.join("; ") : "(unknown)"}`,
    ];
    if (deadTravel.length > 0) {
      lines.push(
        `**Explored from here (travel / exits):** ${deadTravel.join(", ")}`,
      );
    }
    if (deadOther.length > 0) {
      lines.push(
        `**Explored from here (LOOK / objects / other):** ${deadOther.join(", ")}`,
      );
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
   * Session FSM neighborhood (Graphviz DOT) for planner prompts — current cell + a few hops, no verbatim game log.
   */
  private buildPlannerLocalFsmGraphBlock(): string {
    const explore = resolveAutoplayPromptMode() === "explore";
    const snap = this.exploration.toSnapshot(this.mapSnapshotOptions());
    const dot = inferredMapToLocalDot(
      snap,
      explore
        ? { maxHops: 1, maxNodes: 12, maxEdges: 22 }
        : { maxHops: 2, maxNodes: 18, maxEdges: 36 },
    );
    const intro = explore
      ? "Local graph (session only). **YOU ARE HERE** = dark node. Solid=travel; dashed=rejected; dotted=no move / action."
      : "Learned this session only (not engine truth). **Current position:** the **dark filled** node with **thick border** and a **YOU ARE HERE** line in its label (also noted in a `//` comment with the node id). Other nodes use a light fill. **takeable:** lists parser object words still believed on the ground in that room (updated when room text is seen; successful TAKE removes an object from that room; carrying items are subtracted). **Edges:** solid = travel; dashed gray = rejected compass; dotted blue = non-move actions (TAKE, LOOK, EXAMI, …) tried at that node. Self-loops on travel = blocked / no move. Full game text is not included — use **GAME ENGINE STATE**, **EXPLORATION MAP**, **CANDIDATES**, **AT THIS NODE**, and this graph.";
    return [
      "### LOCAL SESSION MAP (Graphviz DOT)",
      intro,
      "```dot",
      dot,
      "```",
    ].join("\n");
  }

  private buildRejectedCommandsBlock(structured: boolean): string | null {
    if (this.rejectedGetinQueue.length === 0) return null;
    const lines = this.rejectedGetinQueue.map(
      (k, i) => `${i + 1}. ${formatRejectedGetinForPrompt(k)}`,
    );
    const title = structured
      ? "### Parser-rejected commands (prefer new lines)"
      : "## Parser-rejected commands (prefer new lines)";
    return `${title}
The game already refused these GETIN lines in the current situation. **Prefer** a different 10-column GETIN line unless the transcript clearly changed.
${lines.join("\n")}`;
  }

  /**
   * Gemma-oriented planner: **system** = {@link mlxAutoplaySystemPrompt} (rules + JSON + background).
   * **user** = GAME ENGINE STATE → CANDIDATES → LOCAL SESSION MAP (DOT); no full transcript (no turn-by-turn log).
   * The worker merges `system` + `user` before generation (`scripts/mlx_lm_worker.py`).
   */
  buildPlannerMxStructuredPrompt(
    maxChars: number,
    options: {
      compact: boolean;
      situationalSection?: string;
    },
  ): { system: string; user: string } {
    const mode = resolveAutoplayPromptMode();
    const situationalSection = options.situationalSection?.trim();
    const situationalBlock =
      situationalSection && situationalSection.length > 0
        ? situationalSection.replace(
            /^## Situation candidates[^\n]*/,
            "### CANDIDATES",
          )
        : "";

    const gameEngineBlock = this.buildGameEngineStateBlockMx();
    const localGraph = this.buildPlannerLocalFsmGraphBlock();

    const sessionFraming =
      mode === "explore"
        ? `### CURRENT SESSION
Pick **one** parser command (JSON in system message). **Lead** with **Try next** and **AT THIS NODE**; vary your choice when the situation is unchanged.`
        : `### CURRENT SESSION
You are in the situation below. Pick **one** parser command using **GAME ENGINE STATE**, **EXPLORATION MAP**, **CANDIDATES**, and **LOCAL SESSION MAP**. In the DOT map, your position is the **dark-filled** node whose label starts with **YOU ARE HERE** (see the section intro). **Prioritize** **Try next** and directions that are still open from the current inferred cell. There is no full game transcript in this message — use parsed state and the DOT neighborhood. Follow the system message for JSON shape and parser rules.`;

    const userSections = [
      sessionFraming,
      "",
      ...(mode === "explore" ? [this.buildCurrentNodeBlockMx(), ""] : []),
      gameEngineBlock,
      ...(situationalBlock ? ["", situationalBlock] : []),
      "",
      localGraph,
    ].join("\n");
    const user =
      userSections.length > maxChars
        ? trimPromptPreservePrefix(userSections, maxChars)
        : userSections;
    return {
      system: mlxAutoplaySystemPrompt(options.compact, mode),
      user,
    };
  }

  /**
   * Assemble full user prompt body for the planner: narrative sections + local session DOT graph,
   * trimmed to `maxChars` (no full verbatim transcript; no numbered recent-move list).
   */
  buildPlannerUserPrompt(
    maxChars: number,
    vocabHint: string,
    options?: {
      compact?: boolean;
      situationalSection?: string;
      structuredDashboard?: boolean;
    },
  ): string {
    const compact = options?.compact ?? false;
    const structured = options?.structuredDashboard ?? false;
    const situationalSection = options?.situationalSection?.trim();
    const mode = resolveAutoplayPromptMode();
    const parserBlock = this.buildParserRejectionBlock(structured);
    const oscillationBlock = this.buildOscillationBlock(structured);
    const stagnationBlock = this.buildStagnationBlock(structured);
    const rejectedBlock = this.buildRejectedCommandsBlock(structured);
    const localGraph = this.buildPlannerLocalFsmGraphBlock();

    const vocabSection = vocabTrim(vocabHint, maxChars);

    let preambleHead: string;
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
    } else {
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

    const out = `${preambleHead}\n\n${localGraph}`;
    return out.length > maxChars
      ? trimPromptPreservePrefix(out, maxChars)
      : out;
  }
}

function vocabTrim(vocabHint: string, maxChars: number): string {
  const cap = Math.min(6000, Math.max(2000, Math.floor(maxChars * 0.45)));
  if (vocabHint.length <= cap) return vocabHint;
  return `${vocabHint.slice(0, cap - 1)}…`;
}

function trimPromptPreservePrefix(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars - 48)}\n…\n[truncated — tail dropped]`;
}
