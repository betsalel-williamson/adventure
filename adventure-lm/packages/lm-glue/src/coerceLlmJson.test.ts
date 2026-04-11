import { describe, expect, it } from "vitest";
import {
  AutoplayPlannerResponseSchema,
  InterpretedCommandSchema,
} from "./schema.js";
import {
  coerceAutoplayPlannerJson,
  coerceInterpretedCommandJson,
} from "./coerceLlmJson.js";

describe("coerceInterpretedCommandJson", () => {
  it("truncates primaryToken to 5 letters and strips null secondary", () => {
    const raw = coerceInterpretedCommandJson({
      primaryToken: "INSTRUCTIONS",
      secondaryToken: null,
      confidence: null,
    });
    const p = InterpretedCommandSchema.parse(raw);
    expect(p.primaryToken).toBe("INSTR");
    expect(p.secondaryToken).toBeUndefined();
    expect(p.confidence).toBeUndefined();
  });

  it("accepts valid JSON after coercion", () => {
    const raw = coerceAutoplayPlannerJson({
      primaryToken: "EAST",
      secondaryToken: null,
      continuePlaying: null,
    });
    const p = AutoplayPlannerResponseSchema.parse(raw);
    expect(p.primaryToken).toBe("EAST");
    expect(p.continuePlaying).toBeUndefined();
  });

  it("coerces continuePlaying strings", () => {
    const raw = coerceAutoplayPlannerJson({
      primaryToken: "NORTH",
      continuePlaying: "false",
    });
    const p = AutoplayPlannerResponseSchema.parse(raw);
    expect(p.continuePlaying).toBe(false);
  });
});
