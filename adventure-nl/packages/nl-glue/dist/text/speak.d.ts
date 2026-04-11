import type { AdventureDatabase, LLineRow } from "../dat/types.js";
/** One physical line as Fortran PRINT (20A4) for columns 3..maxCol. */
export declare function formatLLineRow(row: LLineRow): string;
/** Walk LLINE chain starting at head (1-based index). */
export declare function walkLLineChain(db: AdventureDatabase, head: number): Generator<string>;
/**
 * RTEXT message id for the long HELP response (what the game prints for HELP / ? / WHAT).
 * Matches `adventure.dat` section 6 rows keyed by 51.
 */
export declare const HELP_RTEXT_MESSAGE_ID = 51;
/**
 * Full HELP text from the database (RTEXT 51). Joins all 20 A4 fields per LLINE row and trims trailing
 * spaces so the string matches the adventure.dat source lines (avoids losing the end of a row when
 * {@link formatLLineRow} truncates using inferred maxCol).
 */
export declare function getHelpInstructionText(db: AdventureDatabase): string;
//# sourceMappingURL=speak.d.ts.map