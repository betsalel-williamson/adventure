import type { AdventureDatabase } from "../dat/types.js";

/** Words from adventure.dat ATAB for NL / autoplay prompts (cap list length for context size). */
export function buildVocabHint(
  db: AdventureDatabase,
  maxWords: number,
): string {
  const words: string[] = [];
  for (let i = 1; i < 1000 && words.length < maxWords; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    words.push(db.atab[i].trim());
  }
  return words.join(", ");
}
