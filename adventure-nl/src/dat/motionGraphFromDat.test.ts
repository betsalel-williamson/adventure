import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "./loadDat.js";
import { buildMotionGraphFromDat } from "./motionGraphFromDat.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("buildMotionGraphFromDat", () => {
  it("lists many edges and includes motion from location 1", () => {
    const db = loadDatFile(datPath);
    const { edges, locationIds } = buildMotionGraphFromDat(db);
    expect(edges.length).toBeGreaterThan(100);
    expect(locationIds.length).toBeGreaterThan(10);
    const from1 = edges.filter((e) => e.fromLoc === 1);
    expect(from1.length).toBeGreaterThan(0);
    expect(from1.some((e) => e.motionWord.includes("EAST"))).toBe(true);
  });
});
