import type { AdventureDatabase, LLineRow } from "../dat/types.js";

/** One physical line as Fortran PRINT (20A4) for columns 3..maxCol. */
export function formatLLineRow(row: LLineRow): string {
  const n = row.maxCol - 2;
  return row.chunks.slice(0, n).join("");
}

/** Walk LLINE chain starting at head (1-based index). */
export function* walkLLineChain(
  db: AdventureDatabase,
  head: number,
): Generator<string> {
  let kk = head;
  while (kk !== 0) {
    const row = db.llineRows[kk];
    if (!row) break;
    yield formatLLineRow(row);
    kk = row.next;
  }
}

/**
 * RTEXT message id for the long HELP response (what the game prints for HELP / ? / WHAT).
 * Matches `adventure.dat` section 6 rows keyed by 51.
 */
export const HELP_RTEXT_MESSAGE_ID = 51;

/**
 * Full HELP text from the database (RTEXT 51). Joins all 20 A4 fields per LLINE row and trims trailing
 * spaces so the string matches the adventure.dat source lines (avoids losing the end of a row when
 * {@link formatLLineRow} truncates using inferred maxCol).
 */
export function getHelpInstructionText(db: AdventureDatabase): string {
  const head = db.rtext.get(HELP_RTEXT_MESSAGE_ID);
  if (head === undefined || head === 0) return "";
  const lines: string[] = [];
  let kk = head;
  while (kk !== 0) {
    const row = db.llineRows[kk];
    if (!row) break;
    lines.push(row.chunks.join("").replace(/\s+$/g, ""));
    kk = row.next;
  }
  return lines.join("\n").trim();
}
