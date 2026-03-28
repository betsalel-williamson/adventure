/**
 * Full motion graph from adventure.dat KEY/TRAVEL (spoiler: complete game topology).
 * Encoding matches adventure.f: TRAVEL = destination*1024 + vocabulary index (see loadDat).
 */

import type { AdventureDatabase } from "./types.js";

export type DatMotionEdge = {
  readonly fromLoc: number;
  readonly toLoc: number;
  readonly motionIu: number;
  readonly motionWord: string;
};

/**
 * Enumerate all motion table entries. Last entry in each group may be stored negative in TRAVEL;
 * destination uses absolute value (see adventure.f).
 */
export function buildMotionGraphFromDat(db: AdventureDatabase): {
  readonly edges: readonly DatMotionEdge[];
  readonly locationIds: readonly number[];
} {
  const edges: DatMotionEdge[] = [];
  const locSet = new Set<number>();

  for (let loc = 1; loc < db.key.length; loc++) {
    const start = db.key[loc];
    if (start === 0) continue;
    locSet.add(loc);

    let kk = start;
    while (kk < db.travel.length) {
      const rawSigned = db.travel[kk];
      if (rawSigned === 0) break;
      const raw = Math.abs(rawSigned);
      const toLoc = Math.floor(raw / 1024);
      const motionIu = raw % 1024;
      const motionWord =
        (db.atab[motionIu] ?? "     ").trimEnd() || `#${motionIu}`;
      edges.push({
        fromLoc: loc,
        toLoc,
        motionIu,
        motionWord,
      });
      locSet.add(toLoc);
      kk++;
      if (rawSigned < 0) break;
    }
  }

  const locationIds = [...locSet].sort((a, b) => a - b);
  return { edges, locationIds };
}
