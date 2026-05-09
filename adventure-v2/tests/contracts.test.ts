import { describe, expect, it } from "vitest";
import { buildReconcileTrace } from "../packages/cognition/src/brain/reconcileTrace.js";
import { runTurnBrainGraph } from "../packages/cognition/src/brain/runTurnBrainGraph.js";
import {
  cognitionTraceWireSchema,
  checkpointRefSchema,
  listCheckpointsResponseSchema,
  oracleObservationPayloadSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  reconcileOutcomeSchema,
  runConfigSchema,
  sseWireEventSchema,
  turnEnvelopeSchema
} from "../packages/contracts/src/index.js";

describe("contracts", () => {
  it("parses run config for each model category", () => {
    for (const category of ["SLM", "LLM", "API", "MLX"] as const) {
      const parsed = runConfigSchema.parse({
        scenarioId: "scenario-a",
        modelCategory: category,
        modelName: `${category}-model`,
        seed: 1
      });
      expect(parsed.modelCategory).toBe(category);
    }
  });

  it("parses optional cognitionProfile on run config", () => {
    const withProfile = runConfigSchema.parse({
      scenarioId: "scenario-a",
      modelCategory: "SLM",
      modelName: "m",
      seed: 0,
      cognitionProfile: "plan-a-langgraph-v2"
    });
    expect(withProfile.cognitionProfile).toBe("plan-a-langgraph-v2");

    const without = runConfigSchema.parse({
      scenarioId: "scenario-a",
      modelCategory: "SLM",
      modelName: "m",
      seed: 0
    });
    expect(without.cognitionProfile).toBeUndefined();
  });

  it("parses turn envelope", () => {
    const parsed = turnEnvelopeSchema.parse({
      runId: "run-1",
      turnId: "turn-1",
      sequence: 1,
      source: "cognition",
      kind: "proposal",
      ts: new Date().toISOString(),
      payload: { action: "look" }
    });
    expect(parsed.sequence).toBe(1);
  });

  it("parses reconcile outcome", () => {
    const parsed = reconcileOutcomeSchema.parse({
      runId: "run-1",
      turnId: "turn-1",
      sequence: 1,
      driftDetected: true,
      driftClass: "parser",
      beliefPatch: { parserRejected: true },
      confidenceBefore: 0.8,
      confidenceAfter: 0.5,
      nextPolicy: "test",
      correlationId: "run-1:turn:1",
      driftSummary: "Oracle rejected the proposed action.",
      evidence: { oracleOutcome: "rejected", outputExcerpt: "I do not understand that." }
    });
    expect(parsed.driftClass).toBe("parser");
    expect(parsed.correlationId).toBe("run-1:turn:1");
    expect(parsed.evidence?.oracleOutcome).toBe("rejected");
  });

  it("parses oracle observation payload with outcome", () => {
    const parsed = oracleObservationPayloadSchema.parse({
      rejected: false,
      output: "OK.",
      outcome: "accepted"
    });
    expect(parsed.outcome).toBe("accepted");
  });

  it("parses checkpoint ref", () => {
    const parsed = checkpointRefSchema.parse({
      checkpointId: "cp-1",
      runId: "run-1",
      threadId: "thread-1",
      turnId: "turn-1",
      sequence: 1,
      replayInputRef: "state-1",
      createdAt: new Date().toISOString()
    });
    expect(parsed.checkpointId).toBe("cp-1");
  });

  it("parses list checkpoints HTTP response array", () => {
    const ref = checkpointRefSchema.parse({
      checkpointId: "cp-1",
      runId: "run-1",
      threadId: "thread-1",
      turnId: "turn-1",
      sequence: 1,
      replayInputRef: "state-1",
      createdAt: new Date().toISOString()
    });
    const parsed = listCheckpointsResponseSchema.parse([ref]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.checkpointId).toBe("cp-1");
    expect(listCheckpointsResponseSchema.parse([])).toEqual([]);
  });

  it("parses replay HTTP request and response shapes", () => {
    expect(postReplayRequestSchema.parse({ checkpointId: "cp-1" }).checkpointId).toBe(
      "cp-1"
    );
    const parsed = postReplayResponseSchema.parse({
      checkpointId: "cp-1",
      runId: "run-1",
      sequence: 1,
      replayInputRef: "state-1",
      controlPhase: "act",
      pendingOracleSequence: null,
      restoredAt: new Date().toISOString()
    });
    expect(parsed.controlPhase).toBe("act");
  });

  it("parses SSE wire phase and turn envelopes", () => {
    const turnEv = sseWireEventSchema.parse({
      event: "turn",
      envelope: {
        runId: "run-1",
        turnId: "t-1",
        sequence: 0,
        source: "oracle",
        kind: "oracle_observation",
        ts: new Date().toISOString(),
        payload: { output: "OK.", rejected: false }
      }
    });
    expect(turnEv.event).toBe("turn");

    const phaseEv = sseWireEventSchema.parse({
      event: "phase",
      transition: {
        from: "act",
        to: "disorder",
        reason: "oracle-dispatched",
        sequence: 0,
        ts: new Date().toISOString()
      }
    });
    expect(phaseEv.event).toBe("phase");
    if (phaseEv.event === "phase") {
      expect(phaseEv.transition.to).toBe("disorder");
    }
  });

  it("parses SSE wire cognition trace events", () => {
    const trace = cognitionTraceWireSchema.parse({
      runId: "run-1",
      turnId: "t-1",
      sequence: 1,
      nodeId: "proposal",
      label: "Proposal drafted",
      ts: new Date().toISOString(),
      payload: { action: "look" }
    });
    expect(trace.nodeId).toBe("proposal");

    const traceEv = sseWireEventSchema.parse({
      event: "trace",
      trace
    });
    expect(traceEv.event).toBe("trace");
    if (traceEv.event === "trace") {
      expect(traceEv.trace.label).toBe("Proposal drafted");
    }
  });

  it("parses cognition trace with LangGraph observability fields", () => {
    const trace = cognitionTraceWireSchema.parse({
      runId: "run-1",
      turnId: "t-1",
      sequence: 1,
      nodeId: "plan",
      graphNodeId: "plan",
      stepIndex: 1,
      label: "Plan",
      ts: new Date().toISOString(),
      promptDigest: "a".repeat(16),
      promptSummary: "You are the Adventure",
      promptRole: "system",
      promptSystem: "You are the agent.\nRules…",
      promptUser: "Turn input:\nlook",
      payload: {}
    });
    expect(trace.promptRole).toBe("system");
    expect(trace.stepIndex).toBe(1);
    expect(trace.promptSystem).toContain("You are the agent");
    expect(trace.promptUser).toContain("look");
  });

  it("matches golden LangGraph trace node order for one turn", async () => {
    const brain = await runTurnBrainGraph({
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      rawInput: "look"
    });
    const reconcileTrace = buildReconcileTrace({
      runId: "run-1",
      turnId: "run-1:turn:1",
      sequence: 1,
      reconcile: {
        runId: "run-1",
        turnId: "run-1:turn:1",
        sequence: 1,
        driftDetected: false,
        driftClass: "none",
        beliefPatch: {},
        confidenceBefore: 0.8,
        confidenceAfter: 0.85,
        nextPolicy: "continue"
      }
    });
    const golden = [...brain.traces.map((t) => t.nodeId), reconcileTrace.nodeId];
    expect(golden).toEqual(["perceive", "plan", "act", "reconcile"]);
  });
});

