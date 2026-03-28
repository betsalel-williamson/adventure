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
} from "./adventureNlPrompts.js";
import type { AdventureDatabase } from "../dat/types.js";
import {
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
} from "./situationalCandidates.js";
import {
  interpretedToGetinLine,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "./schema.js";

const MAX_INTERNAL_RAW = 48_000;
const DEFAULT_TURN_LOG_LINES = 24;
/** Shorter turn log for MLX system+user split (vocab + duplicate summaries removed). */
const MX_SPLIT_TURN_LOG_LINES = 12;
/** Cap "recent command" lines in structured dashboard (RTFM: keep history short). */
const DASHBOARD_RECENT_COMMANDS = 8;
const ONE_LINE_OUTCOME_MAX = 160;
/** Max GETIN lines remembered as parser-rejected (FIFO, deduped). */
const MAX_REJECTED_GETIN_QUEUE = 32;

export type AutoplayTurnRecord = {
  command: string;
  outcomeExcerpt: string;
  /** True when the game output matches known parser/word-rejection lines (see adventure.dat RTEXT). */
  outcomeWasParserRejection: boolean;
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

/** Normalize outcome one-liner for comparing “same room line” across turns. */
function fingerprintLocationFromOutcome(excerpt: string): string {
  const t = excerpt.replace(/\s+/g, " ").trim().toUpperCase();
  return t.slice(0, 88);
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
  const fp = last4.map((t) => fingerprintLocationFromOutcome(t.outcomeExcerpt));
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

function extractLocationHint(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const t = line.trim();
    const u = t.toUpperCase();
    if (
      u.startsWith("YOU ARE") ||
      u.includes("END OF A ROAD") ||
      u.includes("WELL HOUSE") ||
      u.includes("IN A VALLEY")
    ) {
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

export class AutoplaySessionMemory {
  private recentRawTail = "";
  private turns: AutoplayTurnRecord[] = [];
  private inventory: string[] = [];
  private locationHint = "";
  private objectNotes: string[] = [];
  /** FIFO of GETIN keys the parser rejected; cleared after any non-rejection outcome. */
  private rejectedGetinQueue: string[] = [];

  /** Raw accumulated transcript tail (for situational candidate extraction). */
  getRecentRawTail(): string {
    return this.recentRawTail;
  }

  /** Seed from transcript before the first `> ` command. */
  seedOpening(transcript: string): void {
    const norm = transcript.replace(/\r\n/g, "\n");
    this.recentRawTail = norm.slice(-MAX_INTERNAL_RAW);
    this.refreshDerived(norm);
  }

  /**
   * Prefix text for interactive NL interpret prompts: heuristic state, short turn log,
   * situational parser-token candidates (parity with autoplay cues). Prepended to raw
   * game output by the CLI; capped so {@link recentGameTextSliceForInterpretPrompt} keeps latest game text.
   */
  buildInteractiveInterpretPrefix(
    db: AdventureDatabase,
    options: { readonly compact: boolean },
  ): string {
    const maxTotal = options.compact ? 900 : 1400;
    const lines: string[] = [
      "### Interactive session context",
      "(Heuristic — same class of signal as autoplay; Fortran output below is authoritative.)",
      "",
      `**Location hint:** ${this.locationHint || "(unknown)"}`,
      this.inventory.length > 0
        ? `**Inventory:** ${this.inventory.join("; ")}`
        : "**Inventory:** (not detected)",
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
    const situ = formatSituationalCandidatesSection(
      buildSituationalCandidateTokens(db, this.recentRawTail),
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
   */
  recordCommandOutcome(command: string, gameOutput: string): void {
    const norm = gameOutput.replace(/\r\n/g, "\n");
    const outcomeWasParserRejection = gameOutputLooksLikeParserRejection(norm);
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
    this.turns.push({
      command: command.trimEnd().slice(0, 24),
      outcomeExcerpt: oneLineExcerpt(norm, ONE_LINE_OUTCOME_MAX),
      outcomeWasParserRejection,
    });
    if (this.turns.length > 400) {
      this.turns.shift();
    }
    this.recentRawTail = (this.recentRawTail + norm).slice(-MAX_INTERNAL_RAW);
    this.refreshDerived(this.recentRawTail);
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

  private refreshDerived(text: string): void {
    this.inventory = extractInventoryFromText(text);
    const loc = extractLocationHint(text);
    if (loc) this.locationHint = loc;
    this.objectNotes = extractObjectNotes(text);
  }

  private buildStateBlock(): string {
    const lines: string[] = ["## Derived state (heuristic from recent output)"];
    lines.push(
      `Location hint: ${this.locationHint || "(unknown — infer from recent game text)"}`,
    );
    if (this.inventory.length > 0) {
      lines.push(`Inventory: ${this.inventory.join("; ")}`);
    } else {
      lines.push("Inventory: (not detected — infer from game text)");
    }
    if (this.objectNotes.length > 0) {
      lines.push(`Notes: ${this.objectNotes.join(" ")}`);
    }
    return lines.join("\n");
  }

  /**
   * Structured dashboard for small MLX models: state first (Fortran output is source of truth).
   */
  private buildAdventureStateBlock(): string {
    const lines: string[] = [
      "### ADVENTURE STATE",
      "(Heuristic from recent game text — the Fortran engine is authoritative.)",
      "",
      `**Location hint:** ${this.locationHint || "(unknown — infer from RECENT GAME OUTPUT below)"}`,
    ];
    if (this.inventory.length > 0) {
      lines.push(`**Inventory:** ${this.inventory.join("; ")}`);
    } else {
      lines.push("**Inventory:** (not detected — infer from game text)");
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
    const loc = this.locationHint || "(unknown — infer from TRANSCRIPT)";
    const inv =
      this.inventory.length > 0
        ? this.inventory.join("; ")
        : "(not detected — infer from transcript)";
    const alerts = this.buildCompactPlannerAlerts();
    const lines: string[] = [
      "### GAME ENGINE STATE",
      `Location: ${loc}`,
      `Inventory: ${inv}`,
    ];
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
        "The parser rejected the last command — pick a different verb or use LOOK/EXAMI (do not repeat the same primary as the previous line in RECENT MOVES).",
      );
    }
    const loop = detectAlternatingLocationCommandLoop(this.turns);
    if (loop !== null) {
      const a =
        loop.locA.length > 40 ? `${loop.locA.slice(0, 39)}…` : loop.locA;
      const b =
        loop.locB.length > 40 ? `${loop.locB.slice(0, 39)}…` : loop.locB;
      out.push(
        `Two-location loop (${a} ↔ ${b}) using \`${loop.repeatedPrimary}\` each time — try LOOK, EXAMI, BUILD, ENTER, or a compass direction; do not repeat \`${loop.repeatedPrimary}\` unless the room clearly changed.`,
      );
    }
    if (this.rejectedGetinQueue.length > 0) {
      const slice = this.rejectedGetinQueue.slice(-8);
      const fmt = slice.map((k) => formatRejectedGetinForPrompt(k)).join("; ");
      out.push(
        `These GETIN lines were refused by the parser; do not repeat the same combination unless the situation changed: ${fmt}${
          this.rejectedGetinQueue.length > 8 ? " …" : ""
        }`,
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
The game did not accept the last command as written. Follow all of these:
- Do **not** repeat the same primaryToken as the previous turn in the log below (unless the room or situation clearly changed).
- Try a **different** verb or object from the vocabulary. Travel/motion words (e.g. BUILD, ENTER) often apply only in specific situations; inside a location, prefer **TAKE** or **GET** with the object in secondaryToken when items are listed on the ground.
- If unsure, use **LOOK** or **EXAMI** to refresh the situation before moving again.`;
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
**Do not** emit the same primaryToken \`${loop.repeatedPrimary}\` again unless the transcript clearly shows a new situation. Prefer **LOOK** or **EXAMI**, then a noun or direction visible in the room text (e.g. **BUILD**, **ENTER**, compass directions).`;
  }

  private buildTurnLogBlock(
    maxLines: number,
    structured: boolean,
    structuredHeading?: string,
  ): string {
    const h = structured
      ? (structuredHeading ?? "### TURN LOG")
      : "## Turn log";
    if (this.turns.length === 0) {
      return `${h}\n(none yet)`;
    }
    const slice = this.turns.slice(-maxLines);
    const lines = slice.map(
      (t, i) =>
        `${i + 1 + this.turns.length - slice.length}. \`${t.command}\` → ${t.outcomeExcerpt}`,
    );
    return `${h} (last ${slice.length} moves)\n${lines.join("\n")}`;
  }

  private buildRejectedCommandsBlock(structured: boolean): string | null {
    if (this.rejectedGetinQueue.length === 0) return null;
    const lines = this.rejectedGetinQueue.map(
      (k, i) => `${i + 1}. ${formatRejectedGetinForPrompt(k)}`,
    );
    const title = structured
      ? "### Parser-rejected commands (do not repeat)"
      : "## Parser-rejected commands (do not repeat)";
    return `${title}
The game already refused these GETIN lines in the current situation. Unless the transcript clearly changed, do **not** choose tokens that produce the same 10-column GETIN line again.
${lines.join("\n")}`;
  }

  /**
   * Gemma-oriented planner: **system** = {@link mlxAutoplaySystemPrompt} (rules + JSON + background).
   * **user** = GAME ENGINE STATE → CANDIDATES → RECENT MOVES → TRANSCRIPT (current situation and options).
   * The worker merges `system` + `user` before generation (`scripts/mlx_lm_worker.py`).
   */
  buildPlannerMxStructuredPrompt(
    maxChars: number,
    options: {
      compact: boolean;
      situationalSection?: string;
    },
  ): { system: string; user: string } {
    const situationalSection = options.situationalSection?.trim();
    const situationalBlock =
      situationalSection && situationalSection.length > 0
        ? situationalSection.replace(
            /^## Situation candidates[^\n]*/,
            "### CANDIDATES",
          )
        : "";

    const gameEngineBlock = this.buildGameEngineStateBlockMx();
    const turnLog = this.buildTurnLogBlock(
      MX_SPLIT_TURN_LOG_LINES,
      true,
      "### RECENT MOVES",
    );
    const rawTail = this.recentRawTail.trim();

    const sessionFraming = `### CURRENT SESSION
You are in the situation below. Pick **one** parser command using **GAME ENGINE STATE**, **CANDIDATES**, **RECENT MOVES**, and **TRANSCRIPT**. Follow the system message for JSON shape and parser rules.`;

    const userSections = [
      sessionFraming,
      "",
      gameEngineBlock,
      ...(situationalBlock ? ["", situationalBlock] : []),
      "",
      turnLog,
      "",
      "### TRANSCRIPT",
      "---",
      rawTail,
      "---",
    ];
    const user = trimPromptToBudget(userSections.join("\n"), maxChars);
    return {
      system: mlxAutoplaySystemPrompt(options.compact),
      user,
    };
  }

  /**
   * Assemble full user prompt body for the planner: narrative sections + raw tail,
   * trimmed to `maxChars` (shrink raw tail first, then older turn lines).
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
    const turnLog = this.buildTurnLogBlock(DEFAULT_TURN_LOG_LINES, structured);
    const parserBlock = this.buildParserRejectionBlock(structured);
    const oscillationBlock = this.buildOscillationBlock(structured);
    const rejectedBlock = this.buildRejectedCommandsBlock(structured);
    const rawTail = this.recentRawTail.trim();

    const vocabSection = vocabTrim(vocabHint, maxChars);
    const recentHeader = structured
      ? "### RECENT GAME OUTPUT (verbatim tail — room details and objects)"
      : "## Recent game output (verbatim tail — use for room details and objects)";

    let preamble: string;
    if (structured) {
      const adventureState = this.buildAdventureStateBlock();
      const taskBlock = autoplayPlannerTaskBlockStructured();
      preamble = [
        ...linesForAutoplayPlannerContextBody(vocabSection, {
          compact,
          structuredDashboard: true,
        }),
        "",
        adventureState,
        "",
        taskBlock,
        ...(situationalSection ? ["", situationalSection] : []),
        "",
        turnLog,
        ...(rejectedBlock ? ["", rejectedBlock] : []),
        ...(parserBlock ? ["", parserBlock] : []),
        ...(oscillationBlock ? ["", oscillationBlock] : []),
        "",
        recentHeader,
        "---",
        rawTail,
        "---",
      ].join("\n");
    } else {
      const stateBlock = this.buildStateBlock();
      preamble = [
        ...linesForAutoplayPlannerContextBody(vocabSection, { compact }),
        ...(situationalSection ? ["", situationalSection] : []),
        "",
        stateBlock,
        "",
        turnLog,
        ...(rejectedBlock ? ["", rejectedBlock] : []),
        ...(parserBlock ? ["", parserBlock] : []),
        ...(oscillationBlock ? ["", oscillationBlock] : []),
        "",
        recentHeader,
        "---",
        rawTail,
        "---",
      ].join("\n");
    }

    return trimPromptToBudget(preamble, maxChars);
  }
}

function vocabTrim(vocabHint: string, maxChars: number): string {
  const cap = Math.min(6000, Math.max(2000, Math.floor(maxChars * 0.45)));
  if (vocabHint.length <= cap) return vocabHint;
  return `${vocabHint.slice(0, cap - 1)}…`;
}

function trimPromptToBudget(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `…[truncated from start]\n\n${s.slice(-(maxChars - 30))}`;
}
