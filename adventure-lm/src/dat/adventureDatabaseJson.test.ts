import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import { loadDatFile } from "./loadDat.js";
import {
  deserializeAdventureDatabaseFromJson,
  serializeAdventureDatabaseToJson,
} from "./adventureDatabaseJson.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("adventureDatabaseJson", () => {
  it.runIf(existsSync(datPath))("round-trips loadDatFile through JSON", () => {
    const db = loadDatFile(datPath);
    const json = serializeAdventureDatabaseToJson(db);
    const raw = JSON.parse(JSON.stringify(json)) as unknown;
    const back = deserializeAdventureDatabaseFromJson(raw);
    expect(back.ktab.length).toBe(db.ktab.length);
    expect(back.atab.length).toBe(db.atab.length);
    expect(back.key.length).toBe(db.key.length);
    expect(back.travel.length).toBe(db.travel.length);
    expect(back.ltext.size).toBe(db.ltext.size);
    expect(back.llineRows.length).toBe(db.llineRows.length);
    expect(back.ktab[1]).toBe(db.ktab[1]);
    expect(back.atab[1]).toBe(db.atab[1]);
  });

  it("rejects unknown version", () => {
    expect(() =>
      deserializeAdventureDatabaseFromJson({
        v: 999,
        ltext: [],
        stext: [],
        btext: [],
        rtext: [],
        llineRows: [],
        key: [],
        travel: [],
        ktab: [],
        atab: [],
      }),
    ).toThrow(/Unsupported adventure database JSON version/);
  });
});
