import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeHttpWebPresetsFromEnv } from "./httpWebPresets.js";

describe("mergeHttpWebPresetsFromEnv", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_HTTP_MODEL;
    delete process.env.ADVENTURE_LLM_HTTP_WEB_PRESETS;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("includes default model first and dedupes extras", () => {
    process.env.ADVENTURE_LLM_HTTP_MODEL = "a";
    process.env.ADVENTURE_LLM_HTTP_WEB_PRESETS = "b, a , c";
    expect(mergeHttpWebPresetsFromEnv()).toEqual(["a", "b", "c"]);
  });
});
