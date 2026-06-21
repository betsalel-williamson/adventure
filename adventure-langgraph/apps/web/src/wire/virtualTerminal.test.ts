import { describe, expect, it } from "vitest";
import type { TurnEnvelope } from "@contracts";
import {
  formatUserEchoLine,
  normalizeOracleOutputLineBreaks,
  oracleObservationText,
  virtualTerminalChunkFromEnvelope,
} from "./virtualTerminal.js";

const oracleEnv = (output: string): TurnEnvelope => ({
  runId: "r",
  turnId: "t",
  sequence: 1,
  source: "oracle",
  kind: "oracle_observation",
  ts: "x",
  payload: { outcome: "accepted", rejected: false, output },
});

describe("virtualTerminalChunkFromEnvelope", () => {
  it("extracts oracle text", () => {
    expect(
      virtualTerminalChunkFromEnvelope(oracleEnv("You are in a forest.")),
    ).toBe("You are in a forest.");
  });

  it("formats proposal", () => {
    const env: TurnEnvelope = {
      runId: "r",
      turnId: "t",
      sequence: 0,
      source: "cognition",
      kind: "proposal",
      ts: "x",
      payload: { action: "north" },
    };
    expect(virtualTerminalChunkFromEnvelope(env)).toBe("[agent] north");
  });
});

describe("normalizeOracleOutputLineBreaks", () => {
  it("collapses 3+ consecutive newlines to a single blank line (paragraph gap)", () => {
    expect(normalizeOracleOutputLineBreaks("a\n\n\nb")).toBe("a\n\nb");
    expect(normalizeOracleOutputLineBreaks("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normalizes CRLF before collapsing", () => {
    expect(normalizeOracleOutputLineBreaks("x\r\n\r\n\r\ny")).toBe("x\n\ny");
  });
});

describe("oracleObservationText", () => {
  it("returns null for non-oracle kinds", () => {
    const env: TurnEnvelope = {
      runId: "r",
      turnId: "t",
      sequence: 0,
      source: "oracle",
      kind: "reconcile",
      ts: "x",
      payload: {},
    };
    expect(oracleObservationText(env)).toBeNull();
  });

  it("applies newline collapsing on oracle output", () => {
    expect(oracleObservationText(oracleEnv("LINE ONE.\n\n\nLINE TWO."))).toBe(
      "LINE ONE.\n\nLINE TWO.",
    );
  });
});

describe("formatUserEchoLine", () => {
  it("echoes trimmed input in caps", () => {
    expect(formatUserEchoLine("  look  ")).toBe("> LOOK");
  });
});
