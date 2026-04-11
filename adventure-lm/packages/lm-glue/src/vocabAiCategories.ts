import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AdventureDatabase } from "./dat/types.js";
import { collectGameVocabTokens } from "./gameVocabEnums.js";

const AI_VOCAB_FILE_SCHEMA_VERSION = 1;

const aiGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  blurb: z.string(),
  tokens: z.array(z.string()),
});

const aiVocabFileSchema = z.object({
  version: z.number().optional(),
  groups: z.array(aiGroupSchema),
});

export type AiVocabCategoryGroup = z.infer<typeof aiGroupSchema>;
export type AiVocabCategoriesFile = z.infer<typeof aiVocabFileSchema>;

/** Five-letter ATAB-style normalization (matches collectGameVocabTokens). */
export function normalizeVocabToken(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 5);
}

const DEFAULT_AI_VOCAB_RELATIVE = ".cache/vocab-categories-ai.json";

/**
 * Path to AI vocabulary JSON.
 * - `ADVENTURE_LM_VOCAB_CATEGORIES_FILE` — explicit file path.
 * - `ADVENTURE_LM_VOCAB_AI_CATEGORIES=1` — use `.cache/vocab-categories-ai.json` under `process.cwd()`.
 * - Otherwise, if that default path exists, it is used (opt-in by placing the generated file).
 */
export function resolveAiVocabCategoriesPath(): string | null {
  if (typeof process === "undefined" || process.env === undefined) {
    return null;
  }
  const explicit = process.env.ADVENTURE_LM_VOCAB_CATEGORIES_FILE?.trim();
  if (explicit && explicit.length > 0) {
    return path.resolve(explicit);
  }
  const defaultPath = path.resolve(process.cwd(), DEFAULT_AI_VOCAB_RELATIVE);
  const on =
    process.env.ADVENTURE_LM_VOCAB_AI_CATEGORIES?.trim().toLowerCase();
  if (on === "1" || on === "true" || on === "yes") {
    return defaultPath;
  }
  if (existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
}

export type ResolvedAiVocabGroups = {
  readonly groups: readonly AiVocabCategoryGroup[];
};

/**
 * Load and validate AI categorization JSON against current `adventure.dat` vocabulary.
 * Returns null if path unset, file missing, parse fails, or coverage is too low.
 */
export function loadAiVocabCategoriesForHint(
  db: AdventureDatabase,
  jsonPath: string,
): ResolvedAiVocabGroups | null {
  if (!existsSync(jsonPath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  } catch {
    return null;
  }
  const parsed = aiVocabFileSchema.safeParse(raw);
  if (!parsed.success) return null;

  const allowed = new Set(collectGameVocabTokens(db));
  if (allowed.size === 0) return null;

  const assigned = new Set<string>();
  const groups: AiVocabCategoryGroup[] = [];

  for (const g of parsed.data.groups) {
    const tok: string[] = [];
    for (const t of g.tokens) {
      const n = normalizeVocabToken(t);
      if (n.length === 0 || !allowed.has(n) || assigned.has(n)) continue;
      assigned.add(n);
      tok.push(n);
    }
    if (tok.length === 0) continue;
    groups.push({
      id: g.id.trim() || "group",
      title: g.title.trim(),
      blurb: g.blurb.trim(),
      tokens: tok,
    });
  }

  const uncategorized: string[] = [];
  for (const w of [...allowed].sort((a, b) => a.localeCompare(b))) {
    if (!assigned.has(w)) uncategorized.push(w);
  }

  if (uncategorized.length > 0) {
    groups.push({
      id: "uncategorized",
      title: "Remaining parser tokens",
      blurb:
        "Words from the game table not placed by the categorization step; still valid in primaryToken or secondaryToken.",
      tokens: uncategorized,
    });
  }

  const coverage = assigned.size / allowed.size;
  if (coverage < 0.65) return null;

  return { groups };
}

export function tryLoadAiVocabCategoriesForHint(
  db: AdventureDatabase,
): ResolvedAiVocabGroups | null {
  const p = resolveAiVocabCategoriesPath();
  if (!p) return null;
  return loadAiVocabCategoriesForHint(db, p);
}

/** Take up to `maxWords` tokens in group order (AI order, then uncategorized last). */
export function pickWordsFromAiGroups(
  groups: readonly AiVocabCategoryGroup[],
  maxWords: number,
): AiVocabCategoryGroup[] {
  const out: AiVocabCategoryGroup[] = [];
  let n = 0;
  for (const g of groups) {
    const slice: string[] = [];
    for (const w of g.tokens) {
      if (n >= maxWords) break;
      slice.push(w);
      n += 1;
    }
    if (slice.length > 0) {
      out.push({ ...g, tokens: slice });
    }
    if (n >= maxWords) break;
  }
  return out;
}

export function formatAiGroupedVocabularyHint(
  groups: readonly AiVocabCategoryGroup[],
  options: { structuredGroups: boolean; compact: boolean },
): string {
  const lines: string[] = [];
  const intro = options.compact
    ? "Tokens are grouped (AI-categorized cache + game vocabulary validation). Use five-letter parser words; motion/verbs often primaryToken; objects often secondaryToken."
    : "Below, parser vocabulary is grouped using an AI-generated categorization file (validated against adventure.dat). Each group includes a short usage hint for primaryToken vs secondaryToken.";
  lines.push(intro);
  lines.push("");

  for (const g of groups) {
    if (g.tokens.length === 0) continue;
    const list = g.tokens.join(", ");
    if (options.structuredGroups) {
      lines.push(`#### ${g.title}`);
      lines.push(g.blurb);
      lines.push(list);
      lines.push("");
    } else {
      lines.push(`- **${g.title}** — ${g.blurb}`);
      lines.push(`  ${list}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}

export { AI_VOCAB_FILE_SCHEMA_VERSION, aiVocabFileSchema };
