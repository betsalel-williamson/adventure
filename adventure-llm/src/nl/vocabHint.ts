import type { AdventureDatabase } from "../dat/types.js";
import { ktabClass } from "../vocab/vocab.js";
import {
  formatAiGroupedVocabularyHint,
  pickWordsFromAiGroups,
  tryLoadAiVocabCategoriesForHint,
} from "./vocabAiCategories.js";

/** KTAB KQ = KTAB/1000+1: motion, object, verb, misc (see adventure.f / situationalCandidates). */
const CLASS_MOTION = 1;
const CLASS_OBJECT = 2;
const CLASS_VERB = 3;
const CLASS_MISC = 4;

export type BuildVocabHintOptions = {
  /**
   * When false, single comma-separated list in original adventure.dat table order
   * (first `maxWords` entries). When true, words are grouped by KTAB class with short guidance.
   * @default true
   */
  grouped?: boolean;
  /**
   * When grouped: `###` subheadings per class (structured prompts). Otherwise bullet-style group labels.
   * @default false
   */
  structuredGroups?: boolean;
  /** Shorter group titles and hints. @default false */
  compact?: boolean;
};

type VocabGroupKey = "motion" | "verb" | "object" | "misc" | "unknown";

const GROUP_ORDER: readonly VocabGroupKey[] = [
  "motion",
  "verb",
  "object",
  "misc",
  "unknown",
];

function bucketForKtab(ktabVal: number): VocabGroupKey {
  const c = ktabClass(ktabVal);
  if (c === CLASS_MOTION) return "motion";
  if (c === CLASS_OBJECT) return "object";
  if (c === CLASS_VERB) return "verb";
  if (c === CLASS_MISC) return "misc";
  return "unknown";
}

/** Collect unique ATAB tokens per KTAB class in first-seen (table) order. */
function bucketsInTableOrder(
  db: AdventureDatabase,
): Record<VocabGroupKey, string[]> {
  const buckets: Record<VocabGroupKey, string[]> = {
    motion: [],
    verb: [],
    object: [],
    misc: [],
    unknown: [],
  };
  const seen: Record<VocabGroupKey, Set<string>> = {
    motion: new Set(),
    verb: new Set(),
    object: new Set(),
    misc: new Set(),
    unknown: new Set(),
  };

  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    const w = db.atab[i].trim();
    if (w.length === 0) continue;
    const b = bucketForKtab(db.ktab[i]);
    if (seen[b].has(w)) continue;
    seen[b].add(w);
    buckets[b].push(w);
  }
  return buckets;
}

/**
 * Take up to `maxWords` tokens, preferring motion → verb → object → misc → unknown
 * (helps small models pick sensible primaries).
 */
function pickWordsFromBuckets(
  buckets: Record<VocabGroupKey, string[]>,
  maxWords: number,
): Record<VocabGroupKey, string[]> {
  const out: Record<VocabGroupKey, string[]> = {
    motion: [],
    verb: [],
    object: [],
    misc: [],
    unknown: [],
  };
  let n = 0;
  for (const key of GROUP_ORDER) {
    for (const w of buckets[key]) {
      if (n >= maxWords) return out;
      out[key].push(w);
      n += 1;
    }
  }
  return out;
}

function groupTitle(
  key: VocabGroupKey,
  compact: boolean,
): { title: string; blurb: string } {
  if (compact) {
    const titles: Record<VocabGroupKey, { t: string; b: string }> = {
      motion: {
        t: "Motion / travel",
        b: "Directions and movement; often sole primaryToken.",
      },
      verb: {
        t: "Actions (verbs)",
        b: "Use with objects in secondaryToken (e.g. TAKE + KEYS).",
      },
      object: {
        t: "Objects / nouns",
        b: "Things in the cave; usually secondaryToken with TAKE/DROP/OPEN.",
      },
      misc: {
        t: "Misc",
        b: "Special tokens such as HELP.",
      },
      unknown: {
        t: "Other tokens",
        b: "Additional parser words.",
      },
    };
    const x = titles[key];
    return { title: x.t, blurb: x.b };
  }
  const titles: Record<VocabGroupKey, { t: string; b: string }> = {
    motion: {
      t: "Motion and travel",
      b: "Directions, entering/leaving, and room-to-room movement. These often appear as primaryToken with no secondary.",
    },
    verb: {
      t: "Actions (verbs)",
      b: "Game actions — pair with an object in secondaryToken when grammar requires (e.g. TAKE or GET with KEYS).",
    },
    object: {
      t: "Objects and nouns",
      b: "Items and surfaces in the world — commonly secondaryToken with TAKE, DROP, OPEN, etc.",
    },
    misc: {
      t: "Miscellaneous",
      b: "Other accepted words such as HELP.",
    },
    unknown: {
      t: "Other parser tokens",
      b: "Additional vocabulary entries from the game table.",
    },
  };
  const x = titles[key];
  return { title: x.t, blurb: x.b };
}

function formatGroupedHint(
  picked: Record<VocabGroupKey, string[]>,
  options: { structuredGroups: boolean; compact: boolean },
): string {
  const lines: string[] = [];
  const intro = options.compact
    ? "Tokens below are grouped by parser kind (five-letter ATAB words). Prefer motion/verb tokens from context."
    : "Below, parser vocabulary from adventure.dat is grouped by kind (KTAB class). Use these five-letter tokens; put the verb or motion in primaryToken and the object or direction in secondaryToken when both apply.";
  lines.push(intro);
  lines.push("");

  for (const key of GROUP_ORDER) {
    const words = picked[key];
    if (words.length === 0) continue;
    const { title, blurb } = groupTitle(key, options.compact);
    const list = words.join(", ");
    if (options.structuredGroups) {
      lines.push(`#### ${title}`);
      lines.push(blurb);
      lines.push(list);
      lines.push("");
    } else {
      lines.push(`- **${title}** — ${blurb}`);
      lines.push(`  ${list}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}

/** Original: first `maxWords` ATAB entries in table order, comma-separated. */
function buildLegacyFlatHint(db: AdventureDatabase, maxWords: number): string {
  const words: string[] = [];
  for (let i = 1; i < 1000 && words.length < maxWords; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    words.push(db.atab[i].trim());
  }
  return words.join(", ");
}

/**
 * Vocabulary excerpt for NL / autoplay prompts (`maxWords` caps).
 * Defaults to **grouped** hints with KTAB-based classes and short usage notes.
 */
export function buildVocabHint(
  db: AdventureDatabase,
  maxWords: number,
  options?: BuildVocabHintOptions,
): string {
  const grouped = options?.grouped !== false;
  if (!grouped) {
    return buildLegacyFlatHint(db, maxWords);
  }
  const n = Math.max(1, Math.min(500, Math.floor(maxWords)));
  const ai = tryLoadAiVocabCategoriesForHint(db);
  if (ai !== null) {
    const picked = pickWordsFromAiGroups(ai.groups, n);
    if (picked.length > 0) {
      return formatAiGroupedVocabularyHint(picked, {
        structuredGroups: options?.structuredGroups ?? false,
        compact: options?.compact ?? false,
      });
    }
  }
  const buckets = bucketsInTableOrder(db);
  const picked = pickWordsFromBuckets(buckets, n);
  return formatGroupedHint(picked, {
    structuredGroups: options?.structuredGroups ?? false,
    compact: options?.compact ?? false,
  });
}
