import { describe, expect, it } from "vitest";
import {
  formatCognitionTraceLine,
  formatCognitionTracePanel,
  formatReconcilePanel,
  formatWireEventForTranscript,
  parseSseWirePayload
} from "../apps/web/src/wireDisplay.js";

describe("wireDisplay", () => {
  it("parses a valid SSE turn wire payload", () => {
    const raw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        source: "cognition",
        kind: "proposal",
        ts: "2026-01-01T00:00:00.000Z",
        payload: { action: "look" }
      }
    });
    const w = parseSseWirePayload(raw);
    expect(w).not.toBeNull();
    expect(w!.event).toBe("turn");
    if (w!.event === "turn") {
      expect(w!.envelope.kind).toBe("proposal");
    }
  });

  it("parses a valid phase wire payload", () => {
    const raw = JSON.stringify({
      event: "phase",
      transition: {
        from: "act",
        to: "disorder",
        reason: "oracle",
        sequence: 1,
        ts: "2026-01-01T00:00:00.000Z"
      }
    });
    const w = parseSseWirePayload(raw);
    expect(w).not.toBeNull();
    expect(w!.event).toBe("phase");
  });

  it("parses a valid cognition trace wire payload", () => {
    const raw = JSON.stringify({
      event: "trace",
      trace: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        nodeId: "proposal",
        label: "Proposal drafted",
        ts: "2026-01-01T00:00:00.000Z",
        payload: { action: "look" }
      }
    });
    const w = parseSseWirePayload(raw);
    expect(w).not.toBeNull();
    expect(w!.event).toBe("trace");
    if (w!.event === "trace") {
      expect(w!.trace.nodeId).toBe("proposal");
    }
  });

  it("returns null for invalid JSON", () => {
    expect(parseSseWirePayload("not-json")).toBeNull();
  });

  it("formats transcript lines for turn and phase", () => {
    const turnRaw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        source: "cognition",
        kind: "proposal",
        ts: "t",
        payload: { action: "north" }
      }
    });
    const turn = parseSseWirePayload(turnRaw);
    expect(turn).not.toBeNull();
    expect(formatWireEventForTranscript(turn!)).toContain("[turn:proposal]");
    expect(formatWireEventForTranscript(turn!)).toContain('"north"');

    const phaseRaw = JSON.stringify({
      event: "phase",
      transition: {
        from: "disorder",
        to: "act",
        reason: "policy",
        sequence: 1,
        ts: "t"
      }
    });
    const phase = parseSseWirePayload(phaseRaw);
    expect(phase).not.toBeNull();
    expect(formatWireEventForTranscript(phase!)).toContain("[phase]");
    expect(formatWireEventForTranscript(phase!)).toContain("disorder → act");
  });

  it("formats cognition trace lines and panels", () => {
    const trace = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      nodeId: "proposal",
      label: "Proposal drafted",
      ts: "t",
      payload: { action: "look" }
    };

    expect(formatCognitionTraceLine(trace)).toContain("[trace:proposal]");
    expect(formatCognitionTraceLine(trace)).toContain('"look"');
    expect(formatCognitionTracePanel(trace)).toContain("Latest cognition trace");
    expect(formatCognitionTracePanel(trace)).toContain("nodeId:   proposal");

    const wire = parseSseWirePayload(JSON.stringify({ event: "trace", trace }));
    expect(wire).not.toBeNull();
    expect(formatWireEventForTranscript(wire!)).toContain("[trace:proposal]");
  });

  it("formats reconcile panel from reconcile envelope", () => {
    const env = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      source: "cognition" as const,
      kind: "reconcile" as const,
      ts: "t",
      payload: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        driftDetected: false,
        driftClass: "none",
        beliefPatch: {},
        confidenceBefore: 0.8,
        confidenceAfter: 0.85,
        nextPolicy: "continue",
        correlationId: "run-1:turn:1",
        evidence: { oracleOutcome: "accepted", outputExcerpt: "OK." }
      }
    };
    const text = formatReconcilePanel(env);
    expect(text).not.toBeNull();
    expect(text!).toContain("driftDetected: false");
    expect(text!).toContain("nextPolicy:    continue");
    expect(text!).toContain("correlationId: run-1:turn:1");
    expect(text!).toContain('"oracleOutcome":"accepted"');
  });
});
