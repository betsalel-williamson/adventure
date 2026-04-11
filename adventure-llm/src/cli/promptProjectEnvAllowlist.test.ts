import { describe, expect, it, afterEach } from "vitest";
import {
  PROMPT_PROJECT_ENV_ALLOWLIST,
  sanitizePromptProjectEnvAllowlist,
  applyAllowlistedEnvToProcess,
  restoreEnvFromBackup,
} from "./promptProjectEnvAllowlist.js";

describe("promptProjectEnvAllowlist", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
  });

  it("sanitize drops unknown keys", () => {
    const o = sanitizePromptProjectEnvAllowlist({
      ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE: "full",
      EVIL_KEY: "x",
    });
    expect(o).toEqual({ ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE: "full" });
  });

  it("apply and restore round-trip", () => {
    const prev = process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    const b = applyAllowlistedEnvToProcess({
      ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE: "explore",
    });
    expect(process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE).toBe("explore");
    restoreEnvFromBackup(b);
    if (prev === undefined)
      delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    else process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = prev;
  });

  it("allowlist set is non-empty", () => {
    expect(PROMPT_PROJECT_ENV_ALLOWLIST.size).toBeGreaterThan(0);
  });
});
