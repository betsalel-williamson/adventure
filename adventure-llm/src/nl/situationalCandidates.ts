import type { AdventureDatabase } from "../dat/types.js";
import {
  DIAGONAL_COMPASS_MOTION_TOKEN_SET,
  isDiagonalCompassMotionEnabled,
} from "./diagonalCompassMotion.js";
import { findVocabIndex, ktabClass } from "../vocab/vocab.js";

/** KTAB encoding: KQ = KTAB/1000+1 in adventure.f (motion / object / verb / misc). */
const CLASS_MOTION = 1;
const CLASS_OBJECT = 2;
const CLASS_VERB = 3;

function skipDiagonalMotionToken(token: string): boolean {
  return (
    !isDiagonalCompassMotionEnabled() &&
    DIAGONAL_COMPASS_MOTION_TOKEN_SET.has(token.trim().toUpperCase())
  );
}

/**
 * True when recent Fortran text indicates the player is in an enclosed building
 * (compass-only travel often fails until they exit).
 */
export function recentTextSuggestsIndoorBuildingNavigation(
  text: string,
): boolean {
  const u = text.replace(/\r\n/g, "\n").toUpperCase();
  if (u.includes("YOU'RE INSIDE BUILDING")) return true;
  if (u.includes("YOU ARE INSIDE A BUILDING")) return true;
  if (u.includes("YOU ARE INSIDE") && u.includes("WELL HOUSE")) return true;
  if (
    u.includes("NO WAY TO GO THAT DIRECTION") &&
    (u.includes("YOU'RE INSIDE") || u.includes("INSIDE BUILDING"))
  ) {
    return true;
  }
  return false;
}

/** Motion tokens to surface first when {@link recentTextSuggestsIndoorBuildingNavigation} is true. */
const INDOOR_EXIT_MOTION_FIRST: readonly string[] = [
  "OUT",
  "BUILD",
  "LEAVE",
  "EXIT",
  "ENTER",
];

const COMPASS_MOTION_DEPRIORITIZE: readonly string[] = [
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "NE",
  "SE",
  "NW",
  "SW",
];

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
  "BUILD",
  "ROAD",
  "GULLY",
  "STREAM",
  "STREA",
  "DEPRE",
  "UPSTR",
  "DOWNS",
];

/**
 * Class-1 motion tokens that only re-print room text: omit from the motion slice and append
 * after verbs/objects so CANDIDATES favor travel and TAKE/GET first.
 */
const DEFER_OBSERVATION_MOTION_TO_TAIL: readonly string[] = ["LOOK", "EXAMI"];

/** Class-3 verbs to surface when present in ATAB (LOOK/EXAMI are class 1 — see DEFER_OBSERVATION_MOTION_TO_TAIL). */
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
/** When room text lists takeable objects, cap motion tokens so pickup + exits stay salient. */
const MAX_MOTION_WHEN_ROOM_OBJECTS = 22;
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
 * Drops lines that look like injected GETIN echoes (`> EAST`, `> TAKE KEYS`) so object-class
 * hints are not polluted by command text in the transcript tail.
 */
export function stripInjectedCommandLinesForObjectHints(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
}

/**
 * Whether an ATAB object word appears in prose: exact token, or any word whose first five
 * letters match (e.g. BOTTL ↔ BOTTLE).
 */
function objectAtabWordInGameText(
  atabWord: string,
  tokensInText: Set<string>,
): boolean {
  const w = atabWord.trim().toUpperCase();
  if (w.length === 0) return false;
  if (tokensInText.has(w)) return true;
  const wp = w.slice(0, 5);
  for (const t of tokensInText) {
    if (t.length >= 5 && t.slice(0, 5) === wp) return true;
  }
  return false;
}

/** ATAB words whose KTAB class is object (class 2), for matching prose to takeable nouns. */
function objectClassWordsFromDat(db: AdventureDatabase): Map<string, string> {
  const objectSet = new Map<string, string>();
  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    const w = trimAtab(db.atab[i]);
    if (w.length === 0) continue;
    if (ktabClass(db.ktab[i]) === CLASS_OBJECT) objectSet.set(w, w);
  }
  return objectSet;
}

/**
 * Lists distinct adventure.dat object-class vocabulary words that appear in `text`
 * (same token matching as {@link buildSituationalCandidateTokens}).
 */
export function listVisibleAdventureObjectsInText(
  db: AdventureDatabase,
  text: string,
): string[] {
  const objectSet = objectClassWordsFromDat(db);
  const tokensInText = tokenizeUpperWords(text);
  const out: string[] = [];
  for (const w of objectSet.keys()) {
    if (objectAtabWordInGameText(w, tokensInText)) out.push(w);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/**
 * Counts distinct adventure.dat object-class vocabulary words that appear in `text`
 * (same token matching as {@link buildSituationalCandidateTokens}).
 */
export function countVisibleAdventureObjectsInText(
  db: AdventureDatabase,
  text: string,
): number {
  return listVisibleAdventureObjectsInText(db, text).length;
}

/**
 * Maps a GETIN secondary (or player word) to the canonical ATAB object word from adventure.dat.
 */
export function matchSecondaryToObjectAtabWord(
  secondary: string,
  db: AdventureDatabase,
): string | undefined {
  const t = secondary.trim().toUpperCase();
  if (t.length === 0) return undefined;
  const objectSet = objectClassWordsFromDat(db);
  const head = t.slice(0, 5);
  if (objectSet.has(head)) return head;
  for (const w of objectSet.keys()) {
    if (w.slice(0, 5) === head) return w;
  }
  return undefined;
}

/**
 * Heuristic subset of parser tokens that are likely relevant: motion words, verbs, and
 * object nouns whose ATAB form appears in recent game text.
 * When at least one such object noun is present, TAKE/GET and those nouns are listed
 * before compass and other motion so the planner tends to pick up items before traveling.
 */
export function buildSituationalCandidateTokens(
  db: AdventureDatabase,
  recentGameText: string,
  options?: {
    maxTotal?: number;
    deprioritize?: readonly string[];
    /** Pull OUT/BUILD/… to the front and push compass to the back of the motion slice. */
    indoorLeaveBuilding?: boolean;
    /**
     * Motion and travel before TAKE/object nouns — exploration-first ordering (see autoplay prompt mode).
     */
    exploreFirst?: boolean;
    /**
     * When set, object-class words already matched in this text (e.g. parsed inventory) are omitted
     * from the object slice so KEYS is not listed as “room” when you only carry it.
     */
    inventorySubtractText?: string;
  },
): string[] {
  const maxTotal = options?.maxTotal ?? DEFAULT_MAX_TOTAL;
  const deprioritize = new Set(
    (options?.deprioritize ?? []).map((t) => t.trim().toUpperCase()),
  );
  if (options?.indoorLeaveBuilding) {
    for (const c of COMPASS_MOTION_DEPRIORITIZE) deprioritize.add(c);
  }
  const motion: string[] = [];
  const objects: string[] = [];
  const verbs: string[] = [];
  const misc: string[] = [];
  const seen = new Set<string>();

  const motionSet = new Map<string, string>();
  const objectSet = objectClassWordsFromDat(db);
  const verbSet = new Map<string, string>();
  const miscSet = new Map<string, string>();

  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    const w = trimAtab(db.atab[i]);
    if (w.length === 0) continue;
    const c = ktabClass(db.ktab[i]);
    if (c === CLASS_MOTION) motionSet.set(w, w);
    else if (c === CLASS_OBJECT) {
      /* already in objectSet */
    } else if (c === CLASS_VERB) verbSet.set(w, w);
    else if (c === CLASS_MISC) miscSet.set(w, w);
  }

  const deferMotion = new Set(DEFER_OBSERVATION_MOTION_TO_TAIL);

  const exploreFirst = options?.exploreFirst === true;
  const textForObjects =
    stripInjectedCommandLinesForObjectHints(recentGameText);
  const tokensInText = tokenizeUpperWords(textForObjects);
  const carriedFromInventory = new Set<string>();
  const invSub = options?.inventorySubtractText?.trim();
  if (invSub) {
    for (const w of listVisibleAdventureObjectsInText(db, invSub)) {
      carriedFromInventory.add(w);
    }
  }
  let visibleRoomObjectCount = 0;
  for (const w of objectSet.keys()) {
    if (carriedFromInventory.has(w)) continue;
    if (objectAtabWordInGameText(w, tokensInText)) visibleRoomObjectCount++;
  }
  const motionCap =
    visibleRoomObjectCount > 0 && !exploreFirst
      ? MAX_MOTION_WHEN_ROOM_OBJECTS
      : MAX_MOTION;

  const push = (arr: string[], w: string) => {
    const t = w.trim();
    if (t.length === 0 || seen.has(t)) return;
    seen.add(t);
    arr.push(t);
  };

  for (const p of MOTION_PRIORITY) {
    if (skipDiagonalMotionToken(p)) continue;
    if (deferMotion.has(p)) continue;
    if (motionSet.has(p)) push(motion, p);
    if (motion.length >= motionCap) break;
  }
  for (const w of [...motionSet.keys()].sort((a, b) => a.localeCompare(b))) {
    if (motion.length >= motionCap) break;
    if (skipDiagonalMotionToken(w)) continue;
    if (deferMotion.has(w)) continue;
    if (!seen.has(w)) push(motion, w);
  }

  for (const w of [...objectSet.keys()].sort((a, b) => a.localeCompare(b))) {
    if (objects.length >= MAX_OBJECTS) break;
    if (carriedFromInventory.has(w)) continue;
    if (objectAtabWordInGameText(w, tokensInText)) push(objects, w);
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
  let motionWorking = motion;
  if (options?.indoorLeaveBuilding) {
    const exitFirst = INDOOR_EXIT_MOTION_FIRST.filter((x) =>
      motionWorking.includes(x),
    );
    if (exitFirst.length > 0) {
      const rest = motionWorking.filter((x) => !exitFirst.includes(x));
      motionWorking = [...exitFirst, ...rest];
    }
  }
  let motionOrdered = motionWorking;
  if (deprioritize.size > 0) {
    const front: string[] = [];
    const back: string[] = [];
    for (const x of motionWorking) {
      (deprioritize.has(x) ? back : front).push(x);
    }
    motionOrdered = [...front, ...back];
  }
  const takeVerbsFirst = verbs.filter((v) => v === "TAKE" || v === "GET");
  const otherVerbs = verbs.filter((v) => v !== "TAKE" && v !== "GET");
  const roomListsTakeableObjects = objects.length > 0;

  if (roomListsTakeableObjects && !exploreFirst) {
    // Prefer TAKE/GET + visible object nouns before leaving; motion comes after.
    for (const x of takeVerbsFirst) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of objects) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of otherVerbs) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of motionOrdered) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
  } else if (roomListsTakeableObjects && exploreFirst) {
    // Exploration-first: travel before take spam when objects are still listed.
    for (const x of motionOrdered) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of takeVerbsFirst) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of objects) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
    for (const x of otherVerbs) {
      if (out.length >= maxTotal) return out;
      out.push(x);
    }
  } else {
    for (const x of motionOrdered) {
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
  }
  for (const x of misc) {
    if (out.length >= maxTotal) return out;
    out.push(x);
  }
  for (const t of DEFER_OBSERVATION_MOTION_TO_TAIL) {
    if (out.length >= maxTotal) return out;
    if (!motionSet.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Short planner-facing gloss for common parser tokens (five-letter ATAB style). */
const TOKEN_PLANNER_HINTS: Readonly<Record<string, string>> = {
  TAKE: "pick up a portable item; put the room object in **secondaryToken**",
  GET: "pick up (synonym of TAKE for many objects); **secondaryToken** = object word",
  DROP: "drop a carried item; **secondaryToken** = object",
  OPEN: "open a door, container, or grate; often needs **secondaryToken**",
  LOCK: "lock/unlock flow (see game); may use **secondaryToken**",
  LOOK: "reprint the full room description (no travel)",
  EXAMI: "examine something; often **EXAMI** + object in two columns",
  INVE: "list what you are carrying",
  HELP: "print in-game help text",
  EAST: "travel east (direction only in **primaryToken**)",
  WEST: "travel west",
  NORTH: "travel north",
  SOUTH: "travel south",
  NE: "travel northeast",
  SE: "travel southeast",
  NW: "travel northwest",
  SW: "travel southwest",
  UP: "go up (vertical move; not “pick up”)",
  DOWN: "go down",
  IN: "enter (e.g. building or passage)",
  OUT: "exit toward outside (often best indoors after taking items)",
  ENTER: "go in / enter",
  LEAVE: "leave current place",
  BUILD: "step out to the building exterior (common from well house)",
  EXIT: "leave / exit",
  ROAD: "move toward the road (location-specific motion)",
  GULLY: "move toward the gully",
  STREAM: "move toward the stream",
  STREA: "stream-related motion word",
  DEPRE: "descend toward depression/canyon area",
  UPSTR: "upstream",
  DOWNS: "downstream",
};

function vocabClassForToken(
  db: AdventureDatabase,
  token: string,
): number | undefined {
  const idx = findVocabIndex(db, token.trim().toUpperCase());
  if (idx === 0) return undefined;
  return ktabClass(db.ktab[idx]!);
}

function plannerHintForToken(db: AdventureDatabase, token: string): string {
  const t = token.trim().toUpperCase();
  const fixed = TOKEN_PLANNER_HINTS[t];
  if (fixed) return fixed;
  const cls = vocabClassForToken(db, t);
  if (cls === CLASS_OBJECT)
    return "object word from recent room text — use as **secondaryToken** with **TAKE**/**GET**";
  if (cls === CLASS_MOTION)
    return "travel / motion word (usually **primaryToken** only)";
  if (cls === CLASS_VERB)
    return "parser verb — use **secondaryToken** for object when required, not a second travel word";
  if (cls === CLASS_MISC) return "misc parser word";
  return "parser vocabulary token";
}

const DEFER_OBSERVE_SET = new Set(DEFER_OBSERVATION_MOTION_TO_TAIL);

/**
 * Markdown section for the planner: grouped “token — hint” lines, pickup before travel.
 */
export function formatSituationalCandidatesSection(
  db: AdventureDatabase,
  candidates: readonly string[],
  appendix?: string,
): string {
  const appendixBlock =
    appendix !== undefined && appendix.trim().length > 0
      ? `\n\n${appendix.trim()}`
      : "";
  if (candidates.length === 0) {
    return `## Situation candidates (heuristic)
(no narrowed list — use vocabulary and transcript below)${appendixBlock}`;
  }

  const pickupVerb: string[] = [];
  const roomObjects: string[] = [];
  const travel: string[] = [];
  const observe: string[] = [];
  const otherVerb: string[] = [];
  const misc: string[] = [];
  const unknown: string[] = [];

  for (const raw of candidates) {
    const t = raw.trim().toUpperCase();
    if (t.length === 0) continue;
    if (t === "TAKE" || t === "GET") {
      pickupVerb.push(t);
      continue;
    }
    if (DEFER_OBSERVE_SET.has(t)) {
      observe.push(t);
      continue;
    }
    const cls = vocabClassForToken(db, t);
    if (cls === CLASS_OBJECT) roomObjects.push(t);
    else if (cls === CLASS_MOTION) travel.push(t);
    else if (cls === CLASS_VERB) otherVerb.push(t);
    else if (cls === CLASS_MISC) misc.push(t);
    else unknown.push(t);
  }

  const lines: string[] = [
    "## Situation candidates (heuristic — prefer these for the next command when they make sense)",
    "",
    "Each line is **TOKEN** — what it is for in this situation (parser uses five-letter words).",
  ];

  const pushBullets = (title: string, tokens: readonly string[]) => {
    if (tokens.length === 0) return;
    lines.push("", title);
    for (const tok of tokens) {
      lines.push(`- **${tok}** — ${plannerHintForToken(db, tok)}`);
    }
  };

  const hasPickupStory = pickupVerb.length > 0 || roomObjects.length > 0;
  if (hasPickupStory) {
    lines.push(
      "",
      "### Pick up items in this room (before leaving)",
      "If the room lists items you are not carrying, **TAKE** or **GET** + object usually comes **before** exit/travel.",
    );
    for (const tok of pickupVerb) {
      lines.push(`- **${tok}** — ${plannerHintForToken(db, tok)}`);
    }
    if (roomObjects.length > 0) {
      lines.push("", "Room objects (match wording in game output):");
      for (const tok of roomObjects) {
        lines.push(`- **${tok}** — ${plannerHintForToken(db, tok)}`);
      }
    }
  }

  pushBullets("### Leave / move (travel and exits)", travel);
  pushBullets("### Look / examine", observe);
  pushBullets("### Other verbs", otherVerb);
  pushBullets("### Misc", misc);
  pushBullets("### Other tokens", unknown);

  return `${lines.join("\n")}${appendixBlock}`;
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
