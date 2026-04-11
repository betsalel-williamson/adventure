/**
 * JSON round-trip for {@link AdventureDatabase} so browser clients can hold
 * the same parsed vocabulary/graph inputs as Node without re-parsing adventure.dat locally.
 */
import type { AdventureDatabase, LLineRow } from "./types.js";

export const ADVENTURE_DATABASE_JSON_VERSION = 1 as const;

export type AdventureDatabaseJsonV1 = {
  readonly v: typeof ADVENTURE_DATABASE_JSON_VERSION;
  readonly ltext: readonly (readonly [number, number])[];
  readonly stext: readonly (readonly [number, number])[];
  readonly btext: readonly (readonly [number, number])[];
  readonly rtext: readonly (readonly [number, number])[];
  readonly llineRows: readonly LLineRow[];
  readonly key: readonly number[];
  readonly travel: readonly number[];
  readonly ktab: readonly number[];
  readonly atab: readonly string[];
};

function mapToPairs(m: Map<number, number>): [number, number][] {
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function pairsToMap(
  pairs: readonly (readonly [number, number])[],
): Map<number, number> {
  return new Map(pairs.map(([k, v]) => [k, v]));
}

/** Serialize parsed adventure.dat to a JSON-safe structure (Maps become sorted entry arrays). */
export function serializeAdventureDatabaseToJson(
  db: AdventureDatabase,
): AdventureDatabaseJsonV1 {
  return {
    v: ADVENTURE_DATABASE_JSON_VERSION,
    ltext: mapToPairs(db.ltext),
    stext: mapToPairs(db.stext),
    btext: mapToPairs(db.btext),
    rtext: mapToPairs(db.rtext),
    llineRows: db.llineRows,
    key: [...db.key],
    travel: [...db.travel],
    ktab: [...db.ktab],
    atab: [...db.atab],
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Restore {@link AdventureDatabase} from {@link serializeAdventureDatabaseToJson} output. */
export function deserializeAdventureDatabaseFromJson(
  raw: unknown,
): AdventureDatabase {
  if (!isObject(raw)) throw new Error("Expected adventure database object");
  const v = raw.v;
  if (v !== ADVENTURE_DATABASE_JSON_VERSION) {
    throw new Error(
      `Unsupported adventure database JSON version: ${String(v)}`,
    );
  }
  const ltext = raw.ltext;
  const stext = raw.stext;
  const btext = raw.btext;
  const rtext = raw.rtext;
  const llineRows = raw.llineRows;
  const key = raw.key;
  const travel = raw.travel;
  const ktab = raw.ktab;
  const atab = raw.atab;
  if (
    !Array.isArray(ltext) ||
    !Array.isArray(stext) ||
    !Array.isArray(btext) ||
    !Array.isArray(rtext)
  ) {
    throw new Error("Invalid adventure database maps");
  }
  if (!Array.isArray(llineRows)) throw new Error("Invalid llineRows");
  if (
    !Array.isArray(key) ||
    !Array.isArray(travel) ||
    !Array.isArray(ktab) ||
    !Array.isArray(atab)
  ) {
    throw new Error("Invalid adventure database arrays");
  }
  return {
    ltext: pairsToMap(ltext as [number, number][]),
    stext: pairsToMap(stext as [number, number][]),
    btext: pairsToMap(btext as [number, number][]),
    rtext: pairsToMap(rtext as [number, number][]),
    llineRows: llineRows as LLineRow[],
    key: [...key] as number[],
    travel: [...travel] as number[],
    ktab: [...ktab] as number[],
    atab: [...atab] as string[],
  };
}
