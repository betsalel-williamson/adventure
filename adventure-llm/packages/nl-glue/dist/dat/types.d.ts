/** Parsed adventure.dat (Fortran loader semantics). */
export type LLineRow = {
    /** Link to next continuation line (0 = end). */
    next: number;
    /** Upper bound column index for print loop (Fortran prints JJ=3..this). */
    maxCol: number;
    /** 1-based row index in lline table (for debugging). */
    rowIndex: number;
    /** Twenty 4-character fields (columns 3–22). */
    chunks: string[];
};
export type AdventureDatabase = {
    /** Linked location long descriptions by location id. */
    ltext: Map<number, number>;
    /** Short descriptions. */
    stext: Map<number, number>;
    /** Object / conditional text (BTEXT). */
    btext: Map<number, number>;
    /** Random / speak messages (RTEXT). */
    rtext: Map<number, number>;
    /** LLINE table (1-based indices in `rows`; 0 = unused). */
    llineRows: LLineRow[];
    /** Motion: KEY[loc] = start index into travel (1-based). */
    key: number[];
    /** TRAVEL entries; negative marks end of group for a source. */
    travel: number[];
    /** Vocabulary KTAB / ATAB (1-based IU index; unused 0). */
    ktab: number[];
    atab: string[];
};
//# sourceMappingURL=types.d.ts.map