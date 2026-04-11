import type { AdventureDatabase } from "../dat/types.js";
/** Pad/truncate to five characters like Fortran ATAB. */
export declare function toA5(s: string): string;
/**
 * Find vocabulary table index for a five-character word (Fortran ATAB compare).
 * Returns 0 if not found.
 */
export declare function findVocabIndex(db: AdventureDatabase, word: string): number;
/** K from KTAB entry: MOD(KTAB(I),1000). */
export declare function ktabK(ktab: number): number;
/** KQ = KTAB(I)/1000+1 per Fortran 2025–2026. */
export declare function ktabClass(ktab: number): number;
//# sourceMappingURL=vocab.d.ts.map