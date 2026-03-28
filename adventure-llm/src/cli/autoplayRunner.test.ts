import { describe, expect, it } from "vitest";
import type { TextLlm } from "../nl/textLlmContract.js";
import type {
  AutoplayPlannerResponse,
  InterpretedCommand,
} from "../nl/schema.js";
import {
  getTextLlmAccessor,
  resolveAutoplayPromptLayout,
} from "./autoplayRunner.js";

function fakeLlm(modelId: string): TextLlm {
  return {
    providerId: "mlx",
    modelId,
    interpretPlayerInput: async (): Promise<InterpretedCommand> => {
      throw new Error("not used");
    },
    planAutoplay: async (): Promise<AutoplayPlannerResponse> => ({
      primaryToken: "NORTH",
      continuePlaying: true,
    }),
    generateUnstructured: async () => "",
  };
}

describe("resolveAutoplayPromptLayout", () => {
  it("returns repair window consistent with compact flag", () => {
    const mlx = resolveAutoplayPromptLayout("mlx");
    expect(mlx.repairTailChars).toBe(mlx.compact ? 1200 : 2500);
    const google = resolveAutoplayPromptLayout("google");
    expect(google.repairTailChars).toBe(google.compact ? 1200 : 2500);
  });
});

describe("getTextLlmAccessor", () => {
  it("returns the same client when given a fixed TextLlm", () => {
    const c = fakeLlm("fixed");
    const get = getTextLlmAccessor(c);
    expect(get()).toBe(c);
    expect(get().modelId).toBe("fixed");
  });

  it("reads updated model when given a mutable ref", () => {
    const ref = { current: fakeLlm("m1") };
    const get = getTextLlmAccessor(ref);
    expect(get().modelId).toBe("m1");
    ref.current = fakeLlm("m2");
    expect(get().modelId).toBe("m2");
  });
});
