import type { AdventureDatabase } from "../dat/types.js";
import { ktabClass } from "../vocab/vocab.js";

/** KTAB encoding: KQ = KTAB/1000+1 in adventure.f (motion / object / verb / misc). */
const CLASS_MOTION = 1;
const CLASS_OBJECT = 2;
const CLASS_VERB = 3;

/** Compass and high-frequency travel words (trimmed ATAB forms) — listed first when present. */
const MOTION_PRIORITY: readonly string[] = [
  "EAST",
  "WEST",
  "NORTH",
  "SOUTH",
  "NE",
  "SE",
  "NW",
  "SW",
  "UP",
  "DOWN",
  "IN",
  "OUT",
  "ENTER",
  "LEAVE",
  "LOOK",
  "EXAMI",
  "BUILD",
  "ROAD",
  "GULLY",
  "STREAM",
  "STREA",
  "DEPRE",
  "UPSTR",
  "DOWNS",
];

/** Class-3 verbs to surface when present in ATAB (LOOK/EXAMI are class 1 in this dat — see MOTION_PRIORITY). */
const VERB_PRIORITY: readonly string[] = [
  "TAKE",
  "GET",
  "DROP",
  "OPEN",
  "LOCK",
  "KILL",
  "FEED",
  "INVE",
];

const CLASS_MISC = 4;

/** Misc vocabulary (class 4) to include when present — HELP, etc. */
const MISC_PRIORITY: readonly string[] = ["HELP"];

const DEFAULT_MAX_TOTAL = 56;
const MAX_MOTION = 36;
const MAX_OBJECTS = 14;
const MAX_VERBS = 12;
const MAX_MISC = 4;

function trimAtab(s: string): string {
  return s.trim();
}

function tokenizeUpperWords(text: string): Set<string> {
  const set = new Set<string>();
  const upper = text.toUpperCase().replace(/\r\n/g, "\n");
  const parts = upper.split(/[^A-Z0-9]+/).filter((p) => p.length > 0);
  for (const p of parts) set.add(p);
  return set;
}

/**
 * Heuristic subset of parser tokens that are likely relevant: motion words, verbs, and
 * object nouns whose ATAB form appears in recent game text.
 */
export function buildSituationalCandidateTokens(
  db: AdventureDatabase,
  recentGameText: string,
  options?: { maxTotal?: number },
): string[] {
  const maxTotal = options?.maxTotal ?? DEFAULT_MAX_TOTAL;
  const motion: string[] = [];
  const objects: string[] = [];
  const verbs: string[] = [];
  const misc: string[] = [];
  const seen = new Set<string>();

  const motionSet = new Map<string, string>();
  const objectSet = new Map<string, string>();
  const verbSet = new Map<string, string>();
  const miscSet = new Map<string, string>();

  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    const w = trimAtab(db.atab[i]);
    if (w.length === 0) continue;
    const c = ktabClass(db.ktab[i]);
    if (c === CLASS_MOTION) motionSet.set(w, w);
    else if (c === CLASS_OBJECT) objectSet.set(w, w);
    else if (c === CLASS_VERB) verbSet.set(w, w);
    else if (c === CLASS_MISC) miscSet.set(w, w);
  }

  const push = (arr: string[], w: string) => {
    const t = w.trim();
    if (t.length === 0 || seen.has(t)) return;
    seen.add(t);
    arr.push(t);
  };

  for (const p of MOTION_PRIORITY) {
    if (motionSet.has(p)) push(motion, p);
    if (motion.length >= MAX_MOTION) break;
  }
  for (const w of [...motionSet.keys()].sort((a, b) => a.localeCompare(b))) {
    if (motion.length >= MAX_MOTION) break;
    if (!seen.has(w)) push(motion, w);
  }

  const tokensInText = tokenizeUpperWords(recentGameText);
  for (const w of [...objectSet.keys()].sort((a, b) => a.localeCompare(b))) {
    if (objects.length >= MAX_OBJECTS) break;
    if (tokensInText.has(w)) push(objects, w);
  }

  for (const p of VERB_PRIORITY) {
    if (verbSet.has(p)) push(verbs, p);
    if (verbs.length >= MAX_VERBS) break;
  }
  for (const w of [...verbSet.keys()].sort((a, b) => a.localeCompare(b))) {
    if (verbs.length >= MAX_VERBS) break;
    if (!seen.has(w)) push(verbs, w);
  }

  for (const p of MISC_PRIORITY) {
    if (miscSet.has(p)) push(misc, p);
    if (misc.length >= MAX_MISC) break;
  }

  const out: string[] = [];
  for (const x of motion) {
    if (out.length >= maxTotal) return out;
    out.push(x);
  }
  for (const x of verbs) {
    if (out.length >= maxTotal) return out;
    out.push(x);
  }
  for (const x of objects) {
    if (out.length >= maxTotal) return out;
    out.push(x);
  }
  for (const x of misc) {
    if (out.length >= maxTotal) return out;
    out.push(x);
  }
  return out;
}

/**
 * Markdown section for the planner prompt: short list the model should prefer.
 */
export function formatSituationalCandidatesSection(
  candidates: readonly string[],
): string {
  if (candidates.length === 0) {
    return `## Situation candidates (heuristic)
(no narrowed list — use vocabulary and transcript below)`;
  }
  return `## Situation candidates (heuristic — prefer these for the next command when they make sense)
${candidates.join(", ")}`;
}

/**
 * Step 1 of optional two-step autoplay (MLX): model picks a subset of allowed tokens.
 */
export function buildAutoplayRelevantTokensFilterPrompt(
  recentGameText: string,
  allowedTokens: readonly string[],
): string {
  const tail = recentGameText.trim().slice(-4000);
  const list = allowedTokens.join(", ");
  return `You are playing Colossal Cave Adventure. From the allowed tokens only, which are plausibly useful for the NEXT single parser command given the recent game text?

Reply ONLY with JSON: {"relevantTokens":["TOKEN1","TOKEN2"]}
Use each token at most once. The list may be empty. Do not invent tokens.

Allowed tokens (choose a subset):
${list}

Recent game output:
---
${tail}
---
`;
}

/** Parse step-1 JSON; only returns tokens present in `allowed` (trimmed five-char style). */
export function parseRelevantTokensResponse(
  raw: unknown,
  allowed: ReadonlySet<string>,
): string[] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const o = raw as Record<string, unknown>;
  const arr = o.relevantTokens ?? o.relevant ?? o.tokens;
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const t = String(x)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);
    if (t.length === 0 || seen.has(t)) continue;
    if (!allowed.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
