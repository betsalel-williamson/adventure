import { describe, expect, it } from "vitest";
import { COGNITION_PROMPT_TEXT_MAX_CHARS } from "../packages/contracts/src/index.js";
import { capPromptTextForWire } from "../packages/cognition/src/brain/promptDigest.js";

describe("capPromptTextForWire", () => {
  it("returns original text when under max", () => {
    expect(capPromptTextForWire("short")).toBe("short");
  });

  it("truncates with ellipsis when over max", () => {
    const long = "a".repeat(COGNITION_PROMPT_TEXT_MAX_CHARS + 50);
    const out = capPromptTextForWire(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBe(COGNITION_PROMPT_TEXT_MAX_CHARS + 1);
  });
});
