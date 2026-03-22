/**
 * In-process session memory for self-acting (autoplay) mode: event log, heuristic
 * derived state, and budgeted prompt text for stateless Gemini calls.
 */

const MAX_INTERNAL_RAW = 48_000;
const DEFAULT_TURN_LOG_LINES = 24;
const ONE_LINE_OUTCOME_MAX = 160;

export type AutoplayTurnRecord = {
  command: string;
  outcomeExcerpt: string;
};

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
    this.turns.push({
      command: command.trimEnd().slice(0, 24),
      outcomeExcerpt: oneLineExcerpt(norm, ONE_LINE_OUTCOME_MAX),
    });
    if (this.turns.length > 400) {
      this.turns.shift();
    }
    this.recentRawTail = (this.recentRawTail + norm).slice(-MAX_INTERNAL_RAW);
    this.refreshDerived(this.recentRawTail);
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

  /**
   * Assemble full user prompt body for the planner: narrative sections + raw tail,
   * trimmed to `maxChars` (shrink raw tail first, then older turn lines).
   */
  buildPlannerUserPrompt(maxChars: number, vocabHint: string): string {
    const stateBlock = this.buildStateBlock();
    const turnLog = this.buildTurnLogBlock(DEFAULT_TURN_LOG_LINES);
    const rawTail = this.recentRawTail.trim();

    const preamble = [
      "You are playing Colossal Cave Adventure as the adventurer.",
      "Choose the next parser command to continue. Reply ONLY with JSON matching the schema.",
      "Rules: primaryToken = verb or motion (5 letters max); secondaryToken = object or direction when needed.",
      "For taking items use TAKE or GET in primaryToken and the object in secondaryToken.",
      "Use only vocabulary words from the list when possible.",
      "",
      "## Vocabulary (words the game parser accepts)",
      vocabTrim(vocabHint, maxChars),
      "",
      stateBlock,
      "",
      turnLog,
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
