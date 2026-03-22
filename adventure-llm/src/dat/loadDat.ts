import { readFileSync } from "node:fs";
import type { AdventureDatabase, LLineRow } from "./types.js";

const BLNK = "    ";

function readI9(line: string): number {
  const field = line.slice(0, 9).trim();
  if (field.length === 0) return 0;
  return parseInt(field, 10);
}

function readA4Chunks(line: string): string[] {
  const rest = line.slice(9).padEnd(80, " ");
  const chunks: string[] = [];
  for (let i = 0; i < 20; i++) {
    chunks.push(rest.slice(i * 4, (i + 1) * 4));
  }
  return chunks;
}

function buildLLineRow(rowIndex: number, chunks: string[]): Omit<LLineRow, "rowIndex"> & { rowIndex: number } {
  let kk = 0;
  for (let k = 1; k <= 20; k++) {
    if (chunks[20 - k] !== BLNK) {
      kk = k;
      break;
    }
  }
  if (kk === 0) {
    throw new Error(`Empty LLINE row at index ${rowIndex}`);
  }
  const maxCol = 20 - kk + 1;
  return { rowIndex, next: 0, maxCol, chunks };
}

function chainAppend(
  rows: LLineRow[],
  map: Map<number, number>,
  jkind: number,
  newIndex: number,
): void {
  if (!map.has(jkind) || map.get(jkind) === 0) {
    map.set(jkind, newIndex);
    return;
  }
  let tail = map.get(jkind)!;
  while (rows[tail - 1].next !== 0) {
    tail = rows[tail - 1].next;
  }
  rows[tail - 1].next = newIndex;
}

export function loadDatFromString(source: string): AdventureDatabase {
  const rawLines = source.split(/\r?\n/);
  let p = 0;

  const rows: LLineRow[] = [];
  const pushRow = (r: Omit<LLineRow, "rowIndex"> & { rowIndex: number }): number => {
    rows.push(r);
    return r.rowIndex;
  };

  const db: AdventureDatabase = {
    ltext: new Map(),
    stext: new Map(),
    btext: new Map(),
    rtext: new Map(),
    llineRows: [],
    key: new Array(301).fill(0),
    travel: new Array(10000).fill(0),
    ktab: new Array(1001).fill(0),
    atab: new Array(1001).fill("     "),
  };

  const readTextSection = (ikind: number): void => {
    while (p < rawLines.length) {
      const line = rawLines[p];
      if (line === undefined) break;
      const jkind = readI9(line);
      if (jkind === -1) {
        p++;
        return;
      }
      const chunks = readA4Chunks(line);
      const rowIndex = rows.length + 1;
      const row = buildLLineRow(rowIndex, chunks);
      pushRow({ ...row, rowIndex });

      if (ikind === 6) {
        chainAppend(rows, db.rtext, jkind, rowIndex);
      } else if (ikind === 5) {
        if (jkind >= 200) {
          chainAppend(rows, db.btext, jkind - 100, rowIndex);
          db.btext.set(jkind - 200, db.btext.get(jkind - 100)!);
        } else {
          chainAppend(rows, db.btext, jkind, rowIndex);
        }
      } else if (ikind === 1) {
        chainAppend(rows, db.ltext, jkind, rowIndex);
      } else if (ikind === 2) {
        chainAppend(rows, db.stext, jkind, rowIndex);
      }
      p++;
    }
  };

  const readMotionSection = (): void => {
    let i = 1;
    while (p < rawLines.length) {
      const line = rawLines[p];
      if (line === undefined) break;
      const padded = line.padEnd(120, " ");
      const jkind = parseInt(padded.slice(0, 10).trim(), 10);
      if (jkind === -1) {
        p++;
        return;
      }
      const lkind = parseInt(padded.slice(10, 20).trim(), 10);
      const tk: number[] = [];
      for (let L = 0; L < 10; L++) {
        tk.push(parseInt(padded.slice(20 + L * 10, 30 + L * 10).trim(), 10));
      }
      p++;

      if (db.key[jkind] !== 0) {
        db.travel[i - 1] = -db.travel[i - 1];
      } else {
        db.key[jkind] = i;
      }
      for (let L = 0; L < 10; L++) {
        if (tk[L] === 0) break;
        db.travel[i] = lkind * 1024 + tk[L];
        i++;
        if (i >= db.travel.length) throw new Error("TRAVEL overflow");
      }
      db.travel[i - 1] = -db.travel[i - 1];
    }
  };

  const readVocabSection = (): void => {
    let iu = 1;
    while (p < rawLines.length) {
      const line = rawLines[p];
      if (line === undefined) break;
      const ktab = readI9(line);
      const atab = line.slice(9, 14).padEnd(5, " ");
      p++;
      if (ktab === -1) return;
      db.ktab[iu] = ktab;
      db.atab[iu] = atab;
      iu++;
      if (iu >= 1000) throw new Error("Too many words");
    }
  };

  const finalize = (): AdventureDatabase => {
    db.llineRows = [{ rowIndex: 0, next: 0, maxCol: 0, chunks: [] }, ...rows];
    return db;
  };

  while (p < rawLines.length) {
    const head = rawLines[p];
    if (head === undefined || head.trim() === "") {
      p++;
      continue;
    }
    const ikinds = readI9(head.padEnd(9, " "));
    if (ikinds === 0) {
      if (head.trim() === "0") {
        p++;
        return finalize();
      }
      p++;
      continue;
    }
    p++;

    switch (ikinds) {
      case 1:
      case 2:
      case 5:
      case 6:
        readTextSection(ikinds);
        break;
      case 3:
        readMotionSection();
        break;
      case 4:
        readVocabSection();
        break;
      default:
        throw new Error(`Unknown IKIND section: ${ikinds}`);
    }
  }

  return finalize();
}

export function loadDatFile(path: string): AdventureDatabase {
  return loadDatFromString(readFileSync(path, "utf8"));
}
