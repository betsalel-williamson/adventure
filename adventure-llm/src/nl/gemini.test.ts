import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import { interpretedToGetinLine, swapInterpretedTokens } from "./schema.js";
import {
  shouldFallbackToClassicForGeminiError,
  validateAgainstVocab,
} from "./gemini.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("shouldFallbackToClassicForGeminiError", () => {
  it("is true for HTTP 429 with quota message", () => {
    const err = Object.assign(new Error("429 Too Many Requests quota"), {
      status: 429,
    });
    expect(shouldFallbackToClassicForGeminiError(err)).toBe(true);
  });

  it("is true when message mentions quota without status", () => {
    expect(
      shouldFallbackToClassicForGeminiError(
        new Error("You exceeded your current quota"),
      ),
    ).toBe(true);
  });

  it("is false for unrelated errors", () => {
    expect(
      shouldFallbackToClassicForGeminiError(new Error("parse failed")),
    ).toBe(false);
  });
});

describe("nl schema", () => {
  it("interpretedToGetinLine packs ten columns", () => {
    const line = interpretedToGetinLine({
      primaryToken: "EAST",
      secondaryToken: "LAMP",
    });
    expect(line.slice(0, 5).trim()).toBe("EAST");
    expect(line.slice(5, 10).trim()).toBe("LAMP");
  });

  it("swapInterpretedTokens exchanges slots for a retry line", () => {
    const swapped = swapInterpretedTokens({
      primaryToken: "TOUCH",
      secondaryToken: "KEYS",
    });
    expect(swapped).not.toBeNull();
    expect(interpretedToGetinLine(swapped!)).toBe(
      interpretedToGetinLine({
        primaryToken: "KEYS",
        secondaryToken: "TOUCH",
      }),
    );
  });

  it("validateAgainstVocab accepts EAST", () => {
    const db = loadDatFile(datPath);
    expect(validateAgainstVocab(db, { primaryToken: "EAST" })).toBe(true);
  });
});
