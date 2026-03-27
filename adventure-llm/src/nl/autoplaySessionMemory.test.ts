import { describe, expect, it } from "vitest";
import { interpretedToGetinLine } from "./schema.js";
import {
  AutoplaySessionMemory,
  detectAlternatingLocationCommandLoop,
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
    expect(p).not.toMatch(/parser rejection \(last turn\)/i);
  });

  it("MLX structured split puts rules in system and CURRENT SESSION + state + CANDIDATES + TRANSCRIPT in user", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST   ", "YOU ARE IN A WELL HOUSE.\n");
    const parts = m.buildPlannerMxStructuredPrompt(20_000, {
      compact: true,
      situationalSection:
        "## Situation candidates (heuristic)\nEAST, WEST, TAKE",
    });
    expect(parts.system.length).toBeGreaterThan(80);
    expect(parts.system).toContain("GETIN");
    expect(parts.system).toContain("JSON");
    expect(parts.user).toContain("### CURRENT SESSION");
    expect(parts.user).not.toContain("### INSTRUCTIONS");
    expect(parts.user).toContain("### GAME ENGINE STATE");
    expect(parts.user.indexOf("### CURRENT SESSION")).toBeLessThan(
      parts.user.indexOf("### GAME ENGINE STATE"),
    );
    expect(parts.user.indexOf("### GAME ENGINE STATE")).toBeLessThan(
      parts.user.indexOf("### CANDIDATES"),
    );
    expect(parts.user).toContain("### CANDIDATES");
    expect(parts.user).toContain("### RECENT MOVES");
    expect(parts.user).toContain("### TRANSCRIPT");
    expect(parts.user).not.toContain("### Vocabulary");
    expect(parts.user).not.toContain("### TASK");
    expect(parts.user).not.toContain("Recent commands");
  });

  it("structured dashboard puts ADVENTURE STATE and TASK before RECENT GAME OUTPUT", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST   ", "YOU ARE IN A WELL HOUSE.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST", {
      structuredDashboard: true,
    });
    expect(p).toContain("### ADVENTURE STATE");
    expect(p).toContain("### TASK");
    expect(p.indexOf("### ADVENTURE STATE")).toBeLessThan(
      p.indexOf("### RECENT GAME OUTPUT"),
    );
    expect(p.indexOf("### TASK")).toBeLessThan(
      p.indexOf("### RECENT GAME OUTPUT"),
    );
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

  it("detectAlternatingLocationCommandLoop finds ROAD ping-pong", () => {
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    const loop = detectAlternatingLocationCommandLoop([
      {
        command: road,
        outcomeExcerpt: "YOU'RE AT HILL IN ROAD.",
        outcomeWasParserRejection: false,
      },
      {
        command: road,
        outcomeExcerpt: "YOU'RE AT END OF ROAD AGAIN.",
        outcomeWasParserRejection: false,
      },
      {
        command: road,
        outcomeExcerpt: "YOU'RE AT HILL IN ROAD.",
        outcomeWasParserRejection: false,
      },
      {
        command: road,
        outcomeExcerpt: "YOU'RE AT END OF ROAD AGAIN.",
        outcomeWasParserRejection: false,
      },
    ]);
    expect(loop?.repeatedPrimary).toBe("ROAD");
    expect(loop?.locA).toContain("HILL");
    expect(loop?.locB).toContain("END OF ROAD");
  });

  it("avoidOscillatingCommand forces LOOK when last four moves are a two-location loop", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("START\n");
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    const adjusted = m.avoidOscillatingCommand({
      primaryToken: "ROAD",
      confidence: 0.99,
    });
    expect(adjusted.primaryToken).toBe("LOOK");
    expect(adjusted.confidence).toBeLessThanOrEqual(0.35);
  });

  it("adds two-location loop section when oscillation detected", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("START\n");
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    const p = m.buildPlannerUserPrompt(20_000, "ROAD, LOOK");
    expect(p).toContain("Two-location loop");
    expect(p).toContain("ROAD");
  });

  it("MLX structured prompt folds oscillation into GAME ENGINE STATE alerts", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("START\n");
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    m.recordCommandOutcome(road, "YOU'RE AT HILL IN ROAD.\n");
    m.recordCommandOutcome(road, "YOU'RE AT END OF ROAD AGAIN.\n");
    const parts = m.buildPlannerMxStructuredPrompt(20_000, { compact: true });
    expect(parts.user).toContain("### GAME ENGINE STATE");
    expect(parts.user).toContain("Alerts:");
    expect(parts.user).toContain("Two-location loop");
    expect(parts.user).not.toContain("### Two-location loop");
  });
});
