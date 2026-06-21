import { describe, expect, it } from "vitest";
import { CRT_AWAITING_ORACLE_PLACEHOLDER } from "../transcript/constants.js";
import {
  deriveSessionSignals,
  formatSessionSignalsForPanel,
} from "./sessionSignals.js";

describe("deriveSessionSignals", () => {
  it("is waiting when transcript is empty", () => {
    const r = deriveSessionSignals("");
    expect(r.phase).toBe("waiting");
    expect(r.recentMoves).toEqual([]);
    expect(r.locationCues).toEqual([]);
  });

  it("is waiting when only oracle placeholder", () => {
    const r = deriveSessionSignals(CRT_AWAITING_ORACLE_PLACEHOLDER);
    expect(r.phase).toBe("waiting");
  });

  it("is ready after game text and captures recent move from echo line", () => {
    const r = deriveSessionSignals(
      "> LOOK\nYOU ARE STANDING AT THE END OF A ROAD.",
    );
    expect(r.phase).toBe("ready");
    expect(r.recentMoves).toEqual(["LOOK"]);
    expect(r.locationCues.some((c) => /YOU ARE STANDING/i.test(c))).toBe(true);
  });

  it("keeps last moves in order up to limit", () => {
    const t = ["> A", "> B", "> C", "> D", "> E", "> F"].join("\n");
    const r = deriveSessionSignals(`${t}\nROOM TEXT`);
    expect(r.recentMoves).toEqual(["B", "C", "D", "E", "F"]);
  });

  it("does not treat echo lines as location cues", () => {
    const r = deriveSessionSignals("> WEST\n> LOOK\nNothing here.");
    expect(r.locationCues).toEqual([]);
  });

  it("matches YOU ARE IN style descriptions", () => {
    const r = deriveSessionSignals(
      "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES.",
    );
    expect(r.locationCues.length).toBeGreaterThanOrEqual(1);
    expect(r.locationCues[0]).toContain("MAZE");
  });

  it("dedupes identical location cue lines", () => {
    const line = "YOU ARE IN A FOREST.";
    const r = deriveSessionSignals(`${line}\n${line}`);
    expect(r.locationCues).toEqual([line]);
  });
});

describe("formatSessionSignalsForPanel", () => {
  it("shows explicit waiting copy", () => {
    const r = deriveSessionSignals(CRT_AWAITING_ORACLE_PLACEHOLDER);
    expect(formatSessionSignalsForPanel(r)).toEqual(["Waiting for game text…"]);
  });

  it("shows ready copy when no cues yet", () => {
    const r = deriveSessionSignals("Some oracle text without YOU ARE.");
    expect(formatSessionSignalsForPanel(r)).toContain(
      "No session cues yet — keep playing.",
    );
  });

  it("includes recent moves when present", () => {
    const r = deriveSessionSignals("> NORTH\nOK.");
    const lines = formatSessionSignalsForPanel(r);
    expect(lines.some((l) => /Recent moves/i.test(l) && /NORTH/.test(l))).toBe(
      true,
    );
  });
});
