import type { AdventureDatabase } from "../dat/types.js";

/** Pad/truncate to five characters like Fortran ATAB. */
export function toA5(s: string): string {
  return s.toUpperCase().slice(0, 5).padEnd(5, " ");
}

/**
 * Find vocabulary table index for a five-character word (Fortran ATAB compare).
 * Returns 0 if not found.
 */
export function findVocabIndex(db: AdventureDatabase, word: string): number {
  const a = toA5(word);
  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    if (db.atab[i] === a) return i;
  }
  return 0;
}

/** K from KTAB entry: MOD(KTAB(I),1000). */
export function ktabK(ktab: number): number {
  return ((ktab % 1000) + 1000) % 1000;
}

/** KQ = KTAB(I)/1000+1 per Fortran 2025–2026. */
export function ktabClass(ktab: number): number {
  return Math.floor(ktab / 1000) + 1;
}
