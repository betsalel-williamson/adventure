import type { AdventureDatabase } from "./dat/types.js";
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
/**
 * Vocabulary excerpt for NL / autoplay prompts (`maxWords` caps).
 * Defaults to **grouped** hints with KTAB-based classes and short usage notes.
 */
export declare function buildVocabHint(db: AdventureDatabase, maxWords: number, options?: BuildVocabHintOptions): string;
//# sourceMappingURL=vocabHint.d.ts.map