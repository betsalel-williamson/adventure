import { describe, expect, it } from "vitest";
import { AutoplaySessionMemory } from "./autoplaySessionMemory.js";

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
});
