import type { AdventureDatabase, LLineRow } from "../dat/types.js";

/** One physical line as Fortran PRINT (20A4) for columns 3..maxCol. */
export function formatLLineRow(row: LLineRow): string {
  const n = row.maxCol - 2;
  return row.chunks.slice(0, n).join("");
}

/** Walk LLINE chain starting at head (1-based index). */
export function* walkLLineChain(db: AdventureDatabase, head: number): Generator<string> {
  let kk = head;
  while (kk !== 0) {
    const row = db.llineRows[kk];
    if (!row) break;
    yield formatLLineRow(row);
    kk = row.next;
  }
}
