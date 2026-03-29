import { describe, expect, it } from "vitest";
import {
  blockBodyChronological,
  collapseTerminalGameTrailingNewlines,
  effectiveTerminalEchoAfterStep,
  sortTranscriptBlocksChronological,
  type TranscriptBlock,
} from "../public/transcriptLayoutLogic.js";

describe("transcriptLayoutLogic", () => {
  it("sortTranscriptBlocksChronological orders by step ascending", () => {
    const blocks: TranscriptBlock[] = [
      { step: 2, parts: ["b"] },
      { step: 0, parts: ["a"] },
      { step: 1, parts: ["c"] },
    ];
    const sorted = sortTranscriptBlocksChronological(blocks);
    expect(sorted.map((x: TranscriptBlock) => x.step)).toEqual([0, 1, 2]);
    expect(blocks[0].step).toBe(2);
  });

  it("blockBodyChronological joins parts oldest-first", () => {
    const b = { step: 1, parts: ["newer", "older"] };
    expect(blockBodyChronological(b)).toBe("oldernewer");
  });

  it("collapseTerminalGameTrailingNewlines keeps a single trailing newline", () => {
    expect(collapseTerminalGameTrailingNewlines("OK  \n")).toBe("OK  \n");
    expect(collapseTerminalGameTrailingNewlines("OK  \n\n")).toBe("OK  \n");
    expect(collapseTerminalGameTrailingNewlines("OK  \n\n\n")).toBe("OK  \n");
  });

  it("collapseTerminalGameTrailingNewlines preserves internal paragraph breaks", () => {
    expect(collapseTerminalGameTrailingNewlines("A\n\nB\n\n")).toBe("A\n\nB\n");
  });

  it("effectiveTerminalEchoAfterStep lowers afterStep when it matches latest block step", () => {
    const sorted: TranscriptBlock[] = [
      { step: 4, parts: ["a"] },
      { step: 5, parts: ["valley"] },
    ];
    const getin = { 5: "DOWN" };
    expect(
      effectiveTerminalEchoAfterStep(
        { afterStep: 5, line: "DOWN", moveNumber: 5 },
        sorted,
        getin,
      ),
    ).toBe(4);
  });

  it("effectiveTerminalEchoAfterStep repairs tail when GETIN matches latest move", () => {
    const sorted: TranscriptBlock[] = [{ step: 5, parts: ["valley"] }];
    const getin = { 5: "DOWN" };
    expect(
      effectiveTerminalEchoAfterStep(
        { afterStep: 5, line: "DOWN", moveNumber: 5 },
        sorted,
        getin,
      ),
    ).toBe(4);
  });

  it("effectiveTerminalEchoAfterStep leaves waiting echo unchanged (no latest block for move)", () => {
    const sorted: TranscriptBlock[] = [{ step: 4, parts: ["prior"] }];
    const getin = { 5: "DOWN" };
    expect(
      effectiveTerminalEchoAfterStep(
        { afterStep: 4, line: "DOWN", moveNumber: 5 },
        sorted,
        getin,
      ),
    ).toBe(4);
  });

  it("effectiveTerminalEchoAfterStep ignores autoplay repair when moveNumber is absent", () => {
    const sorted: TranscriptBlock[] = [{ step: 5, parts: ["x"] }];
    expect(
      effectiveTerminalEchoAfterStep({ afterStep: 5, line: "DOWN" }, sorted, {
        5: "DOWN",
      }),
    ).toBe(5);
  });
});
