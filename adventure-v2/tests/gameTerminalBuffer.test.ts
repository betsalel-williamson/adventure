import { describe, expect, it } from "vitest";
import {
  appendGameTerminalVirtualLine,
  GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER
} from "../apps/web/src/gameTerminalBuffer.js";

describe("gameTerminalBuffer", () => {
  it("keeps awaiting true after user echo while placeholder is showing", () => {
    const r = appendGameTerminalVirtualLine(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER, "> look", {
      awaitingOracleObservation: true,
      chunkKind: "user_echo"
    });
    expect(r.awaitingOracleObservation).toBe(true);
    expect(r.text).toContain(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER);
    expect(r.text).toContain("> look");
  });

  it("clears placeholder on first oracle chunk", () => {
    const mid = appendGameTerminalVirtualLine(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER, "> look", {
      awaitingOracleObservation: true,
      chunkKind: "user_echo"
    });
    const r = appendGameTerminalVirtualLine(mid.text, "OK.", {
      awaitingOracleObservation: mid.awaitingOracleObservation,
      chunkKind: "oracle"
    });
    expect(r.awaitingOracleObservation).toBe(false);
    expect(r.text).not.toContain(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER);
    expect(r.text).toContain("> look");
    expect(r.text).toContain("OK.");
  });

  it("strips only the placeholder prefix when oracle follows meta line", () => {
    const ph = GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER;
    const withMeta = appendGameTerminalVirtualLine(ph, "(stream: connected · run-x)", {
      awaitingOracleObservation: true,
      chunkKind: "meta"
    });
    const r = appendGameTerminalVirtualLine(withMeta.text, "Room text", {
      awaitingOracleObservation: withMeta.awaitingOracleObservation,
      chunkKind: "oracle"
    });
    expect(r.text.startsWith(ph)).toBe(false);
    expect(r.text).toContain("(stream: connected · run-x)");
    expect(r.text).toContain("Room text");
  });
});
