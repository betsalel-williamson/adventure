import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import { walkLLineChain } from "./speak.js";

const datPath = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../../adventure.dat");

describe("speak", () => {
  it("walks long description for location 1", () => {
    const db = loadDatFile(datPath);
    const head = db.ltext.get(1)!;
    const lines = [...walkLLineChain(db, head)];
    expect(lines.join(" ")).toContain("ROAD");
  });
});
