import { describe, expect, it } from "vitest";
import {
  checkpointRefSchema,
  listCheckpointsResponseSchema,
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
      nextPolicy: "test"
    });
    expect(parsed.driftClass).toBe("parser");
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
});

