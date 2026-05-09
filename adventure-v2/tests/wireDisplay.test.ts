import { describe, expect, it } from "vitest";
import {
  appendCognitionTraceEntry,
  COGNITION_TRACE_EMPTY_PLACEHOLDER,
  formatCognitionTraceLine,
  formatCognitionTracePanel,
  formatReconcilePanel,
  formatTurnTranscriptLine,
  formatVirtualTerminalTurnChunk,
  formatVirtualTerminalUserEcho,
  formatVirtualTerminalWireChunk,
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

  it("formats oracle_observation transcript line with a single JSON encoding of output", () => {
    const env = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 2,
      source: "oracle" as const,
      kind: "oracle_observation" as const,
      ts: "2026-01-01T00:00:00.000Z",
      payload: {
        rejected: false,
        outcome: "accepted" as const,
        output: "You are in a hall."
      }
    };
    const line = formatTurnTranscriptLine(env);
    expect(line).toContain("outcome=accepted");
    expect(line).toContain('output="You are in a hall."');
    expect(line.split("output=").length).toBe(2);
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
    expect(formatCognitionTracePanel(trace)).toContain("Cognition trace entry");
    expect(formatCognitionTracePanel(trace)).toContain("nodeId:   proposal");

    const wire = parseSseWirePayload(JSON.stringify({ event: "trace", trace }));
    expect(wire).not.toBeNull();
    expect(formatWireEventForTranscript(wire!)).toContain("[trace:proposal]");
  });

  it("formats plan trace panel with multiline promptSystem and promptUser", () => {
    const trace = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      nodeId: "plan",
      label: "Plan",
      ts: "t",
      promptSystem: "Line A\nLine B",
      promptUser: "User block\nsecond line",
      payload: {}
    };
    const panel = formatCognitionTracePanel(trace);
    expect(panel).toContain("promptSystem:");
    expect(panel).toContain("    Line A");
    expect(panel).toContain("    Line B");
    expect(panel).toContain("promptUser:");
    expect(panel).toContain("    User block");
    expect(panel).toContain("    second line");
  });

  it("formats virtual terminal user echo", () => {
    expect(formatVirtualTerminalUserEcho("look")).toBe("> look");
    expect(formatVirtualTerminalUserEcho("  north  ")).toBe("> north");
    expect(formatVirtualTerminalUserEcho("")).toBe("");
  });

  it("formats virtual terminal chunks from proposal and oracle envelopes", () => {
    const proposal = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      source: "cognition" as const,
      kind: "proposal" as const,
      ts: "t",
      payload: { action: "north" }
    };
    expect(formatVirtualTerminalTurnChunk(proposal)).toBe("[agent] north");

    const oracle = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      source: "oracle" as const,
      kind: "oracle_observation" as const,
      ts: "t",
      payload: {
        rejected: false,
        outcome: "accepted",
        output: "You see a hall.\nThere is a lamp."
      }
    };
    expect(formatVirtualTerminalTurnChunk(oracle)).toBe("You see a hall.\nThere is a lamp.");

    const oracleObj = {
      ...oracle,
      payload: { ...oracle.payload, output: { foo: 1 } }
    };
    expect(formatVirtualTerminalTurnChunk(oracleObj)).toBe('{"foo":1}');
  });

  it("virtual terminal wire chunk ignores non-turn events and non-terminal kinds", () => {
    const proposalRaw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        source: "cognition",
        kind: "proposal",
        ts: "t",
        payload: { action: "take lamp" }
      }
    });
    const proposalWire = parseSseWirePayload(proposalRaw)!;
    expect(formatVirtualTerminalWireChunk(proposalWire)).toBe("[agent] take lamp");

    const phaseRaw = JSON.stringify({
      event: "phase",
      transition: {
        from: "act",
        to: "think",
        reason: "policy",
        sequence: 1,
        ts: "t"
      }
    });
    expect(formatVirtualTerminalWireChunk(parseSseWirePayload(phaseRaw)!)).toBeNull();

    const reconcileRaw = JSON.stringify({
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
    expect(formatVirtualTerminalWireChunk(parseSseWirePayload(reconcileRaw)!)).toBeNull();
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

  it("appends cognition trace entries so plan prompts are not overwritten by reconcile", () => {
    const planTrace = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      nodeId: "plan",
      label: "Plan",
      ts: "t1",
      promptUser: "hello world",
      payload: {}
    };
    const reconcileTrace = {
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      nodeId: "reconcile",
      label: "Reconcile",
      ts: "t2",
      payload: { ok: true }
    };
    let buf = COGNITION_TRACE_EMPTY_PLACEHOLDER;
    buf = appendCognitionTraceEntry(buf, planTrace);
    buf = appendCognitionTraceEntry(buf, reconcileTrace);
    expect(buf).toContain("promptUser:");
    expect(buf).toContain("hello world");
    expect(buf).toContain("nodeId:   reconcile");
    expect(buf).toContain("────────");
  });

  it("truncates accumulated cognition trace when over maxChars", () => {
    const tinyTrace = {
      runId: "r",
      turnId: "t",
      sequence: 1,
      nodeId: "perceive",
      label: "P",
      ts: "t",
      payload: {}
    };
    const longPrefix = "x".repeat(500);
    const buf = appendCognitionTraceEntry(longPrefix, tinyTrace, { maxChars: 120 });
    expect(buf.length).toBeLessThanOrEqual(120);
    expect(buf).toContain("truncated");
    expect(buf).toContain("perceive");
  });
});
