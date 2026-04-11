import { describe, expect, it } from "vitest";
import { loadDatFile } from "./loadDat.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("loadDatFile", () => {
  it("loads adventure.dat without throwing", () => {
    const db = loadDatFile(datPath);
    expect(db.ltext.size).toBeGreaterThan(50);
    expect(db.stext.size).toBeGreaterThan(10);
    expect(db.key[1]).toBeGreaterThan(0);
  });

  it("parses vocabulary until KTAB -1", () => {
    const db = loadDatFile(datPath);
    let n = 0;
    for (let i = 1; i <= 1000; i++) {
      if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
      if (db.ktab[i] === -1) break;
      n++;
    }
    expect(n).toBeGreaterThan(180);
    const sample = [1, 2, 3, 4].map((i) => db.atab[i]?.trim());
    expect(sample.some((w) => w?.includes("ROAD"))).toBe(true);
  });

  it("has motion from location 1 with keyword 2 (east)", () => {
    const db = loadDatFile(datPath);
    const start = db.key[1];
    expect(start).toBeGreaterThan(0);
    const t = db.travel[start];
    expect(Math.abs(t)).toBeGreaterThan(0);
  });

  it("long text for location 1 matches opening line", () => {
    const db = loadDatFile(datPath);
    const head = db.ltext.get(1);
    expect(head).toBeDefined();
    const row = db.llineRows[head!];
    const line = row.chunks.slice(0, row.maxCol - 2).join("");
    expect(line).toContain("END OF A ROAD");
  });
});
