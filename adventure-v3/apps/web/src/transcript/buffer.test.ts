import { describe, expect, it } from "vitest";
import { formatUserEchoLine } from "../wire/virtualTerminal.js";
import { CRT_AWAITING_ORACLE_PLACEHOLDER } from "./constants.js";
import { appendOracleAwareLine, appendTranscriptLine } from "./buffer.js";

describe("appendTranscriptLine", () => {
  it("joins with newline", () => {
    expect(appendTranscriptLine("a", "b")).toBe("a\nb");
  });
});

describe("appendOracleAwareLine", () => {
  it("clears placeholder on oracle chunk", () => {
    const r = appendOracleAwareLine(CRT_AWAITING_ORACLE_PLACEHOLDER, "Room", {
      awaitingOracle: true,
      isOracleChunk: true,
    });
    expect(r.text).toBe("Room");
    expect(r.awaitingOracle).toBe(false);
  });

  it("keeps placeholder after proposal-only append", () => {
    const r = appendOracleAwareLine(
      CRT_AWAITING_ORACLE_PLACEHOLDER,
      "[agent] look",
      {
        awaitingOracle: true,
        isOracleChunk: false,
      },
    );
    expect(r.text).toContain(CRT_AWAITING_ORACLE_PLACEHOLDER);
    expect(r.awaitingOracle).toBe(true);
  });

  it("user echo precedes oracle output when appended in submit order (CRT contract)", () => {
    let text = "";
    const afterEcho = appendOracleAwareLine(text, formatUserEchoLine("look"), {
      awaitingOracle: false,
      isOracleChunk: false,
    });
    text = afterEcho.text;
    const afterOracle = appendOracleAwareLine(text, "YOU ARE IN A FOREST.", {
      awaitingOracle: afterEcho.awaitingOracle,
      isOracleChunk: true,
    });
    text = afterOracle.text;
    expect(text).toBe("> LOOK\nYOU ARE IN A FOREST.");
    expect(text.indexOf("> LOOK")).toBeLessThan(
      text.indexOf("YOU ARE IN A FOREST."),
    );
  });
});
