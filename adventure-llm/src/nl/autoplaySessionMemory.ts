/**
 * In-process session memory for self-acting (autoplay) mode: event log, heuristic
 * derived state, and budgeted prompt text for stateless TextLlm calls.
 * Shared role/rules come from {@link linesForAutoplayPlannerContextBody} in adventureNlPrompts.
 */
import { linesForAutoplayPlannerContextBody } from "./adventureNlPrompts.js";
import {
  interpretedToGetinLine,
  type AutoplayPlannerResponse,
  type InterpretedCommand,
} from "./schema.js";

const MAX_INTERNAL_RAW = 48_000;
const DEFAULT_TURN_LOG_LINES = 24;
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

  /** Seed from transcript before the first `> ` command. */
  seedOpening(transcript: string): void {
    const norm = transcript.replace(/\r\n/g, "\n");
    this.recentRawTail = norm.slice(-MAX_INTERNAL_RAW);
    this.refreshDerived(norm);
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
   * When the last GETIN result was a parser rejection, instruct the planner explicitly.
   * Small models often repeat the same primaryToken unless this is surfaced as state.
   */
  private buildParserRejectionBlock(): string | null {
    const last = this.turns[this.turns.length - 1];
    if (!last?.outcomeWasParserRejection) return null;
    return `## Parser rejection (last turn — first-class state)
The game did not accept the last command as written. Follow all of these:
- Do **not** repeat the same primaryToken as the previous turn in the log below (unless the room or situation clearly changed).
- Try a **different** verb or object from the vocabulary. Travel/motion words (e.g. BUILD, ENTER) often apply only in specific situations; inside a location, prefer **TAKE** or **GET** with the object in secondaryToken when items are listed on the ground.
- If unsure, use **LOOK** or **EXAMI** to refresh the situation before moving again.`;
  }

  private buildTurnLogBlock(maxLines: number): string {
    if (this.turns.length === 0) {
      return "## Turn log\n(none yet)";
    }
    const slice = this.turns.slice(-maxLines);
    const lines = slice.map(
      (t, i) =>
        `${i + 1 + this.turns.length - slice.length}. \`${t.command}\` → ${t.outcomeExcerpt}`,
    );
    return `## Turn log (last ${slice.length} moves)\n${lines.join("\n")}`;
  }

  private buildRejectedCommandsBlock(): string | null {
    if (this.rejectedGetinQueue.length === 0) return null;
    const lines = this.rejectedGetinQueue.map(
      (k, i) => `${i + 1}. ${formatRejectedGetinForPrompt(k)}`,
    );
    return `## Parser-rejected commands (do not repeat)
The game already refused these GETIN lines in the current situation. Unless the transcript clearly changed, do **not** choose tokens that produce the same 10-column GETIN line again.
${lines.join("\n")}`;
  }

  /**
   * Assemble full user prompt body for the planner: narrative sections + raw tail,
   * trimmed to `maxChars` (shrink raw tail first, then older turn lines).
   */
  buildPlannerUserPrompt(maxChars: number, vocabHint: string): string {
    const stateBlock = this.buildStateBlock();
    const turnLog = this.buildTurnLogBlock(DEFAULT_TURN_LOG_LINES);
    const parserBlock = this.buildParserRejectionBlock();
    const rejectedBlock = this.buildRejectedCommandsBlock();
    const rawTail = this.recentRawTail.trim();

    const vocabSection = vocabTrim(vocabHint, maxChars);
    const preamble = [
      ...linesForAutoplayPlannerContextBody(vocabSection),
      "",
      stateBlock,
      "",
      turnLog,
      ...(rejectedBlock ? ["", rejectedBlock] : []),
      ...(parserBlock ? ["", parserBlock] : []),
      "",
      "## Recent game output (verbatim tail — use for room details and objects)",
      "---",
      rawTail,
      "---",
    ].join("\n");

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
