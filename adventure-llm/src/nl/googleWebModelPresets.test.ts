import { describe, expect, it } from "vitest";
import {
  isAllowedGoogleWebModelId,
  mergeGoogleWebPresetsFromEnv,
} from "./googleWebModelPresets.js";

function withGeminiTextModel<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.GEMINI_TEXT_MODEL;
  try {
    if (value === undefined) delete process.env.GEMINI_TEXT_MODEL;
    else process.env.GEMINI_TEXT_MODEL = value;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.GEMINI_TEXT_MODEL;
    else process.env.GEMINI_TEXT_MODEL = prev;
  }
}

describe("mergeGoogleWebPresetsFromEnv", () => {
  it("prepends GEMINI_TEXT_MODEL when set and not already curated", () => {
    withGeminiTextModel("gemini-2.0-flash-thinking-exp-01-21", () => {
      const m = mergeGoogleWebPresetsFromEnv();
      expect(m[0]).toBe("gemini-2.0-flash-thinking-exp-01-21");
      expect(m).toContain("gemini-2.5-flash");
    });
  });

  it("does not duplicate when GEMINI_TEXT_MODEL matches a curated id", () => {
    withGeminiTextModel("gemini-2.5-flash", () => {
      const m = mergeGoogleWebPresetsFromEnv();
      expect(m.filter((x) => x === "gemini-2.5-flash").length).toBe(1);
    });
  });
});

describe("isAllowedGoogleWebModelId", () => {
  it("allows curated ids and rejects unknown", () => {
    withGeminiTextModel(undefined, () => {
      expect(isAllowedGoogleWebModelId("gemini-2.5-flash")).toBe(true);
      expect(isAllowedGoogleWebModelId("unknown-model")).toBe(false);
    });
  });

  it("allows GEMINI_TEXT_MODEL when not in curated list", () => {
    withGeminiTextModel("gemini-2.0-flash-thinking-exp-01-21", () => {
      expect(
        isAllowedGoogleWebModelId("gemini-2.0-flash-thinking-exp-01-21"),
      ).toBe(true);
    });
  });
});
