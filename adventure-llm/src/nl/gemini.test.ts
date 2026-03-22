import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import { interpretedToGetinLine } from "./schema.js";
import { validateAgainstVocab } from "./gemini.js";

const datPath = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../../adventure.dat");

describe("nl schema", () => {
  it("interpretedToGetinLine packs ten columns", () => {
    const line = interpretedToGetinLine({ primaryToken: "EAST", secondaryToken: "LAMP" });
    expect(line.slice(0, 5).trim()).toBe("EAST");
    expect(line.slice(5, 10).trim()).toBe("LAMP");
  });

  it("validateAgainstVocab accepts EAST", () => {
    const db = loadDatFile(datPath);
    expect(validateAgainstVocab(db, { primaryToken: "EAST" })).toBe(true);
  });
});
