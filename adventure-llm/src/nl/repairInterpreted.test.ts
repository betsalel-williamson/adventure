import { describe, expect, it } from "vitest";
import { interpretedToGetinLine } from "./schema.js";
import { repairInterpretedCommand } from "./repairInterpreted.js";

describe("repairInterpretedCommand", () => {
  it("maps phrasal pick-up + motion UP to TAKE + KEYS when game mentions KEYS", () => {
    const game = "WHAT DO YOU WANT TO DO WITH THE KEYS?\n";
    const r = repairInterpretedCommand(
      "pick them up",
      { primaryToken: "UP", confidence: 0.7 },
      game,
    );
    expect(r.primaryToken).toBe("TAKE");
    expect(r.secondaryToken).toBe("KEYS");
    expect(interpretedToGetinLine(r).trimEnd()).toMatch(/^TAKE\s+KEYS/);
  });

  it("maps take-the-keys object-only primary to TAKE KEYS", () => {
    const r = repairInterpretedCommand(
      "take the keys",
      { primaryToken: "KEYS" },
      "",
    );
    expect(r).toEqual({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
      confidence: undefined,
    });
  });

  it("maps keep them + WITH THE KEYS context to TAKE KEYS", () => {
    const r = repairInterpretedCommand(
      "keep them",
      { primaryToken: "TOUCH", secondaryToken: "NULL", confidence: 0.3 },
      "WHAT DO YOU WANT TO DO WITH THE KEYS?",
    );
    expect(r.primaryToken).toBe("TAKE");
    expect(r.secondaryToken).toBe("KEYS");
  });

  it("does not treat explicit go up as pick up", () => {
    const r = repairInterpretedCommand(
      "go up",
      { primaryToken: "UP" },
      "YOU ARE IN A PIT.",
    );
    expect(r.primaryToken).toBe("UP");
  });
});
