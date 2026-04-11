import type { AdventureDatabase } from "../dat/types.js";
export type VerbSynonymGroup = {
    /** Entries that share this KTAB value are parser synonyms for the same verb. */
    ktab: number;
    /** Trimmed five-letter ATAB forms, sorted for display. */
    tokens: string[];
};
/**
 * Groups adventure.dat verb-class vocabulary by identical KTAB (true parser synonyms).
 */
export declare function buildVerbSynonymGroups(db: AdventureDatabase): VerbSynonymGroup[];
//# sourceMappingURL=verbSynonymGroups.d.ts.map