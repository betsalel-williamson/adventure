import { describe, expect, it } from "vitest";
import {
  compareInterpretEval,
  ktabClass,
  normalizeInterpretEvalToken,
  toA5,
} from "./index.js";

describe("@adventure-lm/lm-glue public API (ADR0014 Phase A)", () => {
  it("exposes vocabulary and interpret-eval helpers with stable behavior", () => {
    expect(toA5("take")).toBe("TAKE ");
    expect(ktabClass(3000)).toBe(4);
    expect(normalizeInterpretEvalToken("  get  ")).toBe("GET");
    expect(
      compareInterpretEval(
        { primaryToken: "TAKE", secondaryToken: "LAMP" },
        { primaryToken: "take", secondaryToken: "lamp" },
      ).ok,
    ).toBe(true);
  });
});
