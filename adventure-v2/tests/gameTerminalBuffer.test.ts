import { describe, expect, it } from "vitest";
import { parseSseWirePayload } from "../apps/web/src/wireDisplay.js";
import {
  appendGameTerminalVirtualLine,
  GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER,
  gameTerminalTurnAppendFromWire
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

  it("maps whitespace-only oracle_observation to empty line but still appends (clears wait placeholder)", () => {
    const raw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        source: "oracle",
        kind: "oracle_observation",
        ts: "t",
        payload: { rejected: false, outcome: "accepted", output: "\n\n\n" }
      }
    });
    const wire = parseSseWirePayload(raw)!;
    const append = gameTerminalTurnAppendFromWire(wire);
    expect(append).not.toBeNull();
    expect(append!.line).toBe("");
    expect(append!.chunkKind).toBe("oracle");

    const r = appendGameTerminalVirtualLine(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER, append!.line, {
      awaitingOracleObservation: true,
      chunkKind: "oracle"
    });
    expect(r.awaitingOracleObservation).toBe(false);
    expect(r.text).not.toContain(GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER);
  });

  it("builds classic CRT order when user echo is appended before SSE proposal and oracle", () => {
    let text = GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER;
    text = appendGameTerminalVirtualLine(text, "> look", {
      awaitingOracleObservation: true,
      chunkKind: "user_echo"
    }).text;
    text = appendGameTerminalVirtualLine(text, "[agent] look", {
      awaitingOracleObservation: true,
      chunkKind: "proposal"
    }).text;
    const r = appendGameTerminalVirtualLine(text, "You are in a hall.", {
      awaitingOracleObservation: true,
      chunkKind: "oracle"
    });
    expect(r.text.indexOf("> look")).toBeLessThan(r.text.indexOf("[agent]"));
    expect(r.text.indexOf("[agent]")).toBeLessThan(r.text.indexOf("You are in a hall."));
    expect(r.text).toContain("You are in a hall.");
    expect(r.awaitingOracleObservation).toBe(false);
  });

  it("returns null for reconcile turn events (no CRT lane chunk)", () => {
    const raw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        source: "cognition",
        kind: "reconcile",
        ts: "t",
        payload: {}
      }
    });
    expect(gameTerminalTurnAppendFromWire(parseSseWirePayload(raw)!)).toBeNull();
  });
});
