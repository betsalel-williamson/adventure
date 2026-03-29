import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatFile } from "../dat/loadDat.js";
import { interpretedToGetinLine } from "./schema.js";
import {
  AutoplaySessionMemory,
  detectAlternatingLocationCommandLoop,
  gameOutputLooksLikeBlockedMove,
  gameOutputLooksLikeParserRejection,
  gameOutputLooksLikePlayAgainPrompt,
  normalizeGetinLineKey,
} from "./autoplaySessionMemory.js";
import { fingerprintLocationFromGameOutput } from "./inferredExplorationMap.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

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

describe("gameOutputLooksLikeBlockedMove", () => {
  it("detects no way to go that direction", () => {
    expect(
      gameOutputLooksLikeBlockedMove(
        "THERE IS NO WAY TO GO THAT DIRECTION.\n\nYOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.\n",
      ),
    ).toBe(true);
  });

  it("is false for successful move text", () => {
    expect(
      gameOutputLooksLikeBlockedMove(
        "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE.\n",
      ),
    ).toBe(false);
  });
});

describe("gameOutputLooksLikePlayAgainPrompt", () => {
  it("detects game over and play again", () => {
    expect(
      gameOutputLooksLikePlayAgainPrompt(
        "IT GETS YOU!\n\nGAME IS OVER.  PLAY AGAIN?\n",
      ),
    ).toBe(true);
  });

  it("is false for normal play", () => {
    expect(
      gameOutputLooksLikePlayAgainPrompt("YOU ARE IN OPEN FOREST.\n"),
    ).toBe(false);
  });
});

describe("AutoplaySessionMemory", () => {
  it("updates location hint from the latest room line (YOU'RE, not stale opening)", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening(
      "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING.\n",
    );
    expect(m.getLocationHint()).toContain("STANDING AT THE END OF A ROAD");
    m.recordCommandOutcome("ROAD   ", "YOU'RE AT END OF ROAD AGAIN.\n");
    expect(m.getLocationHint()).toContain("END OF ROAD AGAIN");
  });

  it("seeds opening and records turns", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("WELCOME\nYOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST    ", "YOU ARE INSIDE A WELL HOUSE.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST, WEST, TAKE");
    expect(p).toContain("EAST, WEST, TAKE");
    expect(p).toContain("YOU ARE INSIDE");
    expect(p).toContain("WELL HOUSE");
    expect(p).toContain("### LOCAL SESSION MAP");
    expect(p).not.toContain("## Turn log");
    expect(p).not.toContain("### RECENT MOVES");
    expect(m.getRecentRawTail()).toMatch(
      /> EAST[\s\S]*YOU ARE INSIDE A WELL HOUSE/,
    );
  });

  it("buildInteractiveInterpretPrefix includes session and candidates", () => {
    const db = loadDatFile(datPath);
    const m = new AutoplaySessionMemory();
    m.seedOpening(
      "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BUILDING.\n",
    );
    m.recordCommandOutcome("EAST    ", "INSIDE THE BUILDING ARE KEYS.\n");
    const prefix = m.buildInteractiveInterpretPrefix(db, { compact: true });
    expect(prefix).toContain("Interactive session context");
    expect(prefix).toContain("Recent moves:");
    expect(prefix).toMatch(/EAST/i);
  });

  it("trims prompt when over budget", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("x".repeat(30_000));
    const p = m.buildPlannerUserPrompt(1200, "WORD");
    expect(p.length).toBeLessThanOrEqual(1200 + 50);
    expect(p).toMatch(/truncated|tail dropped/i);
  });

  it("detects carrying line in output", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening(
      "YOU ARE CARRYING:\n  A LAMP\n  KEYS\nYOU ARE IN A HALLWAY.\n",
    );
    const p = m.buildPlannerUserPrompt(8000, "LAMP");
    expect(p.toLowerCase()).toContain("inventory");
  });

  it("does not treat YOU ARE ALREADY CARRYING as location hint", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening(
      "YOU'RE IN FOREST.\n> TAKE KEYS\nYOU ARE ALREADY CARRYING IT!\n",
    );
    const snap = m.buildAutoplayUiSnapshot();
    expect(snap.locationHint.toUpperCase()).toContain("FOREST");
    expect(snap.locationHint.toUpperCase()).not.toContain("ALREADY CARRYING");
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
    expect(p).toMatch(/\*\*new\*\* primaryToken|prefer another verb/i);
  });

  it("omits parser rejection section after a successful turn", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST   ", "YOU ARE IN A FOREST.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST");
    expect(p).not.toMatch(/parser rejection \(last turn\)/i);
  });

  it("MLX structured split puts rules in system and CURRENT SESSION + state + CANDIDATES + local DOT in user", () => {
    const prev = process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = "full";
    try {
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
      expect(parts.user).not.toContain("### RECENT MOVES");
      expect(parts.user).toContain("### LOCAL SESSION MAP");
      expect(parts.user).toContain("```dot");
      expect(parts.user).toContain("digraph planner_local_fsm");
      expect(parts.user).toMatch(/WELL HOUSE/i);
      expect(parts.user).not.toContain("### Vocabulary");
      expect(parts.user).not.toContain("### TASK");
      expect(parts.user).not.toContain("Recent commands");
    } finally {
      if (prev === undefined)
        delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
      else process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = prev;
    }
  });

  it("MLX structured explore mode leads with AT THIS NODE and EXPLORATION MAP", () => {
    const prev = process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = "explore";
    try {
      const m = new AutoplaySessionMemory();
      m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
      m.recordCommandOutcome("EAST   ", "YOU ARE IN A WELL HOUSE.\n");
      const parts = m.buildPlannerMxStructuredPrompt(20_000, {
        compact: true,
        situationalSection: "## Situation candidates\nEAST",
      });
      expect(parts.user).toContain("### AT THIS NODE");
      expect(parts.user).toContain("### EXPLORATION MAP");
      expect(parts.user).not.toContain("### GAME ENGINE STATE");
      expect(parts.user.indexOf("### AT THIS NODE")).toBeLessThan(
        parts.user.indexOf("### EXPLORATION MAP"),
      );
    } finally {
      if (prev === undefined)
        delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
      else process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = prev;
    }
  });

  it("structured dashboard puts ADVENTURE STATE and TASK before LOCAL SESSION MAP", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    m.recordCommandOutcome("EAST   ", "YOU ARE IN A WELL HOUSE.\n");
    const p = m.buildPlannerUserPrompt(20_000, "EAST", {
      structuredDashboard: true,
    });
    expect(p).toContain("### ADVENTURE STATE");
    expect(p).toContain("### TASK");
    expect(p.indexOf("### ADVENTURE STATE")).toBeLessThan(
      p.indexOf("### LOCAL SESSION MAP"),
    );
    expect(p.indexOf("### TASK")).toBeLessThan(
      p.indexOf("### LOCAL SESSION MAP"),
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

  it("avoidRedundantTakeWhenCarrying substitutes when already carrying object", () => {
    const db = loadDatFile(datPath);
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE CARRYING:\n  KEYS\nYOU ARE IN A ROOM.\n", {
      adventureDb: db,
    });
    expect(m.getStructuredInventory().join(" ").toUpperCase()).toContain(
      "KEYS",
    );
    const adjusted = m.avoidRedundantTakeWhenCarrying({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
      continuePlaying: true,
    });
    expect(adjusted.primaryToken).not.toBe("TAKE");
  });

  it("detectAlternatingLocationCommandLoop finds ROAD ping-pong", () => {
    const road = interpretedToGetinLine({ primaryToken: "ROAD" });
    const ex1 = "YOU'RE AT HILL IN ROAD.";
    const ex2 = "YOU'RE AT END OF ROAD AGAIN.";
    const loop = detectAlternatingLocationCommandLoop([
      {
        command: road,
        outcomeExcerpt: ex1,
        outcomeLocationFingerprint: fingerprintLocationFromGameOutput(ex1),
        outcomeWasParserRejection: false,
        outcomeHadFortranOk: false,
      },
      {
        command: road,
        outcomeExcerpt: ex2,
        outcomeLocationFingerprint: fingerprintLocationFromGameOutput(ex2),
        outcomeWasParserRejection: false,
        outcomeHadFortranOk: false,
      },
      {
        command: road,
        outcomeExcerpt: ex1,
        outcomeLocationFingerprint: fingerprintLocationFromGameOutput(ex1),
        outcomeWasParserRejection: false,
        outcomeHadFortranOk: false,
      },
      {
        command: road,
        outcomeExcerpt: ex2,
        outcomeLocationFingerprint: fingerprintLocationFromGameOutput(ex2),
        outcomeWasParserRejection: false,
        outcomeHadFortranOk: false,
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
    const prev = process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = "full";
    try {
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
    } finally {
      if (prev === undefined)
        delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
      else process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = prev;
    }
  });

  it("MLX structured prompt includes EXPLORATION MAP block", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE AT THE END OF A ROAD.\n");
    const parts = m.buildPlannerMxStructuredPrompt(20_000, { compact: true });
    expect(parts.user).toContain("### EXPLORATION MAP");
    expect(parts.user).toMatch(/\(x,y,z\)=\(0,0,0\)|inferred position/i);
  });

  it("adds stagnation block and alert after repeated same location", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const look = interpretedToGetinLine({ primaryToken: "LOOK" });
    const room = "YOU ARE STANDING AT THE END OF A ROAD BEFORE A BUILDING.\n";
    m.recordCommandOutcome(look, room);
    m.recordCommandOutcome(look, room);
    m.recordCommandOutcome(look, room);
    expect(m.isLocationStagnating()).toBe(true);
    const p = m.buildPlannerUserPrompt(20_000, "LOOK", {
      structuredDashboard: true,
    });
    expect(p).toMatch(/stagnation|No location change/i);
    const parts = m.buildPlannerMxStructuredPrompt(12_000, { compact: true });
    expect(parts.user).toMatch(/No location change|stagnation/i);
  });

  it("avoidRepeatedLookExamiInSameCell allows first LOOK in a room", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const out = m.avoidRepeatedLookExamiInSameCell({
      primaryToken: "LOOK",
      confidence: 0.9,
    });
    expect(out.primaryToken).toBe("LOOK");
  });

  it("avoidRepeatedLookExamiInSameCell replaces second LOOK in same room", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const look = interpretedToGetinLine({ primaryToken: "LOOK" });
    m.recordCommandOutcome(look, "YOU ARE STANDING AT THE END OF A ROAD.\n");
    const adjusted = m.avoidRepeatedLookExamiInSameCell({
      primaryToken: "LOOK",
      secondaryToken: "ROAD",
      confidence: 0.9,
    });
    expect(adjusted.primaryToken).toBe("SOUTH");
    expect(adjusted.secondaryToken).toBeUndefined();
  });

  it("avoidStagnatingCommand replaces repeated GETIN when stagnating", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE STANDING AT THE END OF A ROAD.\n");
    const look = interpretedToGetinLine({ primaryToken: "LOOK" });
    const room = "YOU ARE STANDING AT THE END OF A ROAD BEFORE A BUILDING.\n";
    m.recordCommandOutcome(look, room);
    m.recordCommandOutcome(look, room);
    m.recordCommandOutcome(look, room);
    const adjusted = m.avoidStagnatingCommand({
      primaryToken: "LOOK",
      confidence: 0.9,
    });
    expect(adjusted.primaryToken).toBe("SOUTH");
    expect(adjusted.secondaryToken).toBeUndefined();
  });

  it("getStructuredInventory returns parsed carrying lines", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE CARRYING:\n  A LAMP\nYOU ARE IN A HALLWAY.\n");
    expect(m.getStructuredInventory().join(" ")).toMatch(/LAMP/i);
  });

  it("getStructuredInventory infers KEYS from Fortran OK after TAKE KEYS", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE INSIDE A BUILDING.\nTHERE ARE SOME KEYS HERE.\n");
    const takeKeys = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    m.recordCommandOutcome(takeKeys, "\n\nOK\n\n");
    expect(m.getStructuredInventory()).toContain("KEYS");
  });

  it("getStructuredInventory removes item after DROP with Fortran OK", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("ROOM\n");
    const takeKeys = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    const dropKeys = interpretedToGetinLine({
      primaryToken: "DROP",
      secondaryToken: "KEYS",
    });
    m.recordCommandOutcome(takeKeys, "OK\n");
    expect(m.getStructuredInventory()).toContain("KEYS");
    m.recordCommandOutcome(dropKeys, "OK\n");
    expect(m.getStructuredInventory()).toEqual([]);
  });

  it("getStructuredInventory does not add KEYS when take fails (no OK)", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("ROOM\n");
    const takeKeys = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    m.recordCommandOutcome(takeKeys, "I SEE NO KEYS HERE.\n");
    expect(m.getStructuredInventory().length).toBe(0);
  });

  it("getStructuredInventory infers COINS and BIRD from loose take commands", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("ROOM\n");
    m.recordCommandOutcome("take coins", "OK\n");
    m.recordCommandOutcome("take bird", "OK\n");
    const inv = m.getStructuredInventory();
    expect(inv).toContain("COINS");
    expect(inv).toContain("BIRD");
  });

  it("getStructuredInventory infers TAKE with extra spaces between words", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("ROOM\n");
    m.recordCommandOutcome("TAKE  COINS", "OK\n");
    expect(m.getStructuredInventory()).toContain("COINS");
  });

  it("getStructuredInventory detects OK after many lines of output", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("ROOM\n");
    const prefix = Array.from({ length: 25 }, (_, i) => `ECHO ${i}`).join("\n");
    m.recordCommandOutcome(
      interpretedToGetinLine({ primaryToken: "TAKE", secondaryToken: "LAMP" }),
      `${prefix}\nOK\n`,
    );
    expect(m.getStructuredInventory()).toContain("LAMP");
  });

  it("getStructuredInventory clears inferred items after Fortran INIT DONE (play again)", () => {
    const m = new AutoplaySessionMemory();
    m.seedOpening("YOU ARE INSIDE A BUILDING.\nTHERE ARE SOME KEYS HERE.\n");
    const takeKeys = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "KEYS",
    });
    m.recordCommandOutcome(takeKeys, "OK\n");
    expect(m.getStructuredInventory()).toContain("KEYS");

    const y = interpretedToGetinLine({ primaryToken: "Y" });
    m.recordCommandOutcome(
      y,
      "INIT DONE\n\nYOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK\nBUILDING.\n",
    );
    expect(m.getStructuredInventory().length).toBe(0);

    const takeLamp = interpretedToGetinLine({
      primaryToken: "TAKE",
      secondaryToken: "LAMP",
    });
    m.recordCommandOutcome(takeLamp, "OK\n");
    const inv = m.getStructuredInventory();
    expect(inv).toContain("LAMP");
    expect(inv).not.toContain("KEYS");
  });
});
