import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import {
  interpretedToGetinLine,
  swapInterpretedTokens,
} from "@adventure-lm/lm-glue";
import {
  shouldFallbackToClassicForGeminiError,
  validateAgainstVocab,
} from "./gemini.js";
import { shouldFallbackToClassicForLlmError } from "./llmErrors.js";
import { AutoplayPlannerResponseSchema } from "@adventure-lm/lm-glue";

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

  it("matches shouldFallbackToClassicForLlmError for google", () => {
    const err = new Error("quota");
    expect(shouldFallbackToClassicForGeminiError(err)).toBe(
      shouldFallbackToClassicForLlmError(err, "google"),
    );
  });
});

describe("shouldFallbackToClassicForLlmError (http and mlx)", () => {
  it("is true for ECONNREFUSED message", () => {
    expect(
      shouldFallbackToClassicForLlmError(
        new Error("fetch failed: ECONNREFUSED"),
        "http",
      ),
    ).toBe(true);
  });

  it("is false for parse errors", () => {
    expect(
      shouldFallbackToClassicForLlmError(new Error("Unexpected token"), "http"),
    ).toBe(false);
  });

  it("matches http behavior for mlx subprocess errors", () => {
    expect(
      shouldFallbackToClassicForLlmError(
        new Error("MLX worker exited code=1 signal=null"),
        "mlx",
      ),
    ).toBe(true);
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

  it("AutoplayPlannerResponseSchema accepts continuePlaying", () => {
    const p = AutoplayPlannerResponseSchema.parse({
      primaryToken: "EAST",
      continuePlaying: false,
    });
    expect(p.continuePlaying).toBe(false);
  });
});
