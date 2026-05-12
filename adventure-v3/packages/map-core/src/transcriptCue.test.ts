import { describe, expect, it } from "vitest";
import {
  extractLastNavigationContext,
  parseCompassToken,
  lineStartsWithYouAre,
} from "./transcriptCue.js";

describe("parseCompassToken", () => {
  it("parses letter and word forms", () => {
    expect(parseCompassToken("n")).toBe("n");
    expect(parseCompassToken("NORTH")).toBe("n");
    expect(parseCompassToken("south")).toBe("s");
  });
});

describe("extractLastNavigationContext", () => {
  it("returns null move when only YOU ARE appears", () => {
    expect(
      extractLastNavigationContext("YOU ARE AT END OF ROAD WEST."),
    ).toEqual({
      lastMove: null,
      youAreEvidence: "YOU ARE AT END OF ROAD WEST.",
    });
  });

  it("pairs last echo with subsequent YOU ARE", () => {
    const t =
      "YOU ARE IN HALLWAY.\n" + "> NORTH\n" + "YOU ARE AT END OF ROAD WEST.";
    expect(extractLastNavigationContext(t)).toEqual({
      lastMove: "n",
      youAreEvidence: "YOU ARE AT END OF ROAD WEST.",
    });
  });
});

describe("lineStartsWithYouAre", () => {
  it("matches oracle room lines only", () => {
    expect(lineStartsWithYouAre("YOU ARE IN A MAZE")).toBe(true);
    expect(lineStartsWithYouAre('SOME TEXT WITHOUT YOU ARE"')).toBe(false);
  });
});
