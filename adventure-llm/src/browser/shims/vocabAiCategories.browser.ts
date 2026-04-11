/**
 * Browser shim: no filesystem AI vocab cache; keep the same exports as
 * {@link @adventure-llm/nl-glue} `vocabAiCategories` for esbuild (ADR0005 bundle).
 */
import type { AdventureDatabase } from "../../dat/types.js";
import { z } from "zod";

export const AI_VOCAB_FILE_SCHEMA_VERSION = 1;

const aiGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  blurb: z.string(),
  tokens: z.array(z.string()),
});

export const aiVocabFileSchema = z.object({
  version: z.number().optional(),
  groups: z.array(aiGroupSchema),
});

export type AiVocabCategoryGroup = z.infer<typeof aiGroupSchema>;
export type AiVocabCategoriesFile = z.infer<typeof aiVocabFileSchema>;

/** Five-letter ATAB-style normalization (matches collectGameVocabTokens). */
export function normalizeVocabToken(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 5);
}

export function resolveAiVocabCategoriesPath(): string | null {
  return null;
}

export type ResolvedAiVocabGroups = {
  readonly groups: readonly AiVocabCategoryGroup[];
};

export function loadAiVocabCategoriesForHint(
  db: AdventureDatabase,
  jsonPath: string,
): ResolvedAiVocabGroups | null {
  void db;
  void jsonPath;
  return null;
}

export function tryLoadAiVocabCategoriesForHint(
  db: AdventureDatabase,
): ResolvedAiVocabGroups | null {
  void db;
  return null;
}

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
