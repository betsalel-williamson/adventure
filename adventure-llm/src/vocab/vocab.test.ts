import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import { findVocabIndex, ktabK, toA5 } from "./vocab.js";

const datPath = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../../adventure.dat");

describe("vocabulary", () => {
  const db = loadDatFile(datPath);

  it("finds ROAD motion word", () => {
    const ix = findVocabIndex(db, "ROAD");
    expect(ix).toBeGreaterThan(0);
    expect(ktabK(db.ktab[ix])).toBeGreaterThan(0);
  });

  it("toA5 pads and uppercases", () => {
    expect(toA5("east")).toBe("EAST ");
  });
});
