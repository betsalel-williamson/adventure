import { describe, expect, it } from "vitest";
import { interpretedToGetinLine } from "./schema.js";
import {
  AutoplaySessionMemory,
  gameOutputLooksLikeParserRejection,
  normalizeGetinLineKey,
} from "./autoplaySessionMemory.js";

describe("normalizeGetinLineKey", () => {
  it("matches interpretedToGetinLine for two-word commands", () => {
    const line = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    expect(normalizeGetinLineKey(line)).toBe(line);
    expect(normalizeGetinLineKey("  take keys  ")).toBe(line);
  });
});

describe("gameOutputLooksLikeParserRejection", () => {
  it("detects apply-word rejection", () => {
    expect(
      gameOutputLooksLikeParserRejection(
        "I DON'T KNOW HOW TO APPLY THAT WORD HERE.",
      ),
    ).toBe(true);
  });

  it("detects nothing happens", () => {
    expect(gameOutputLooksLikeParserRejection("NOTHING HAPPENS.")).toBe(true);
  });

  it("is false for normal room text", () => {
    expect(
      gameOutputLooksLikeParserRejection(
        "YOU ARE INSIDE A BUILDING. THERE ARE KEYS HERE.",
      ),
    ).toBe(false);
  });
});

describe("AutoplaySessionMemory", () => {
  it("seeds opening and records turns", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("WELCOME\nYOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST    ", "YOU ARE INSIDE A WELL HOUSE.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST, WEST, TAKE");
    expect(p).toContain("EAST, WEST, TAKE");
    expect(p).toContain("YOU ARE INSIDE");
    expect(p).toContain("END OF A ROAD");
    expect(p).toContain("Turn log");
  });

  it("trims prompt when over budget", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("x".repeat(30_000));
    const p = m.buildPlannerUserPrompt(4000, "WORD");
    expect(p.length).toBeLessThanOrEqual(4000 + 50);
    expect(p).toContain("truncated");
  });

  it("detects carrying line in output", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening(
      "YOU ARE CARRYING:\n  A LAMP\n  KEYS\nYOU ARE IN A HALLWAY.\n",
    );
    const p = m.buildPlannerUserPrompt(8000, "LAMP");
    expect(p.toLowerCase()).toContain("inventory");
  });

  it("adds parser rejection section when last outcome was rejected", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome(
      "BUILD   ",
      "I DON'T KNOW HOW TO APPLY THAT WORD HERE.\nYOU ARE STILL HERE.\n",
    );
    const p = m.buildPlannerUserPrompt(20_000, "BUILD, TAKE");
    expect(p).toContain("Parser rejection");
    expect(p).toContain("Do **not** repeat");
  });

  it("omits parser rejection section after a successful turn", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST   ", "YOU ARE IN A FOREST.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST");
    expect(p).not.toContain("## Parser rejection");
  });

  it("lists parser-rejected GETIN lines and clears after success", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("START\n");
    const buildLine = interpretedToGetinLine({ primaryToken: "BUILD" });
    m.recordCommandOutcome(
      buildLine,
      "I DON'T KNOW HOW TO APPLY THAT WORD HERE.\n",
    );
    let p = m.buildPlannerUserPrompt(20_000, "BUILD");
    expect(p).toContain("Parser-rejected commands");
    expect(p).toContain("`BUILD`");

    m.recordCommandOutcome(
      interpretedToGetinLine({ primaryToken: "LOOK" }),
      "YOU SEE A LAMP.\n",
    );
    p = m.buildPlannerUserPrompt(20_000, "LOOK");
    expect(p).not.toContain("Parser-rejected commands");
  });

  it("avoidRepeatingRejectedCommand substitutes when GETIN matches queue", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("X\n");
    const buildLine = interpretedToGetinLine({ primaryToken: "BUILD" });
    m.recordCommandOutcome(
      buildLine,
      "I DON'T KNOW HOW TO APPLY THAT WORD HERE.\n",
    );
    const adjusted = m.avoidRepeatingRejectedCommand({
      primaryToken: "BUILD",
      confidence: 0.9,
    });
    expect(adjusted.primaryToken).not.toBe("BUILD");
    expect(adjusted.primaryToken).toBe("LOOK");
  });
});
