import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRunConfig, givenStartedRun } from "./steps/runSteps.js";
import type { ModelCategory } from "../packages/contracts/src/index.js";

const feature = (name: string): string =>
  readFileSync(resolve(process.cwd(), "tests", "features", name), "utf8");

describe("acceptance features are present", () => {
  it("loads R1-R5 feature files", () => {
    expect(feature("r1_model_swap.feature")).toContain("Scenario Outline");
    expect(feature("r2_replay.feature")).toContain("Replay");
    expect(feature("r3_reconcile.feature")).toContain("parser drift");
    expect(feature("r4_observability.feature")).toContain("phase transition");
    expect(feature("r5_invalid_action.feature")).toContain("chaos");
  });
});

describe("R1 model swap benchmark execution", () => {
  it.each(["SLM", "LLM", "API", "MLX"] as const)(
    "starts a comparable run for %s",
    (category: ModelCategory) => {
      const world = givenStartedRun(category);
      const metadata = world.coordinator.runMetadata(world.runId);
      expect(metadata.config).toEqual(createRunConfig(category));
    }
  );
});

describe("R2 deterministic replay", () => {
  it("restores replay payload from checkpoint", () => {
    const world = givenStartedRun();
    const turn = world.coordinator.processTurn(world.runId, "look");
    const replayReady = world.coordinator.replay(turn.checkpoint.checkpointId);

    expect(replayReady.checkpointId).toBe(turn.checkpoint.checkpointId);
    expect(replayReady.controlPhase).toBe("act");
    expect(replayReady.replayInputRef).toContain(world.runId);
  });
});

describe("R3 drift-aware reconcile", () => {
  it("surfaces parser drift metadata on reject", () => {
    const world = givenStartedRun();
    const turn = world.coordinator.processTurn(world.runId, "xyzzy", { forceReject: true });

    expect(turn.reconcile.driftDetected).toBe(true);
    expect(turn.reconcile.driftClass).toBe("parser");
    expect(turn.reconcile.nextPolicy).toBe("test");
  });
});

describe("R4 observability stream behavior", () => {
  it("emits ordered turn artifacts and phase transitions", () => {
    const world = givenStartedRun();
    world.coordinator.processTurn(world.runId, "look");

    const events = world.coordinator.eventsForRun(world.runId);
    const kinds = events.map((event) => event.kind);
    expect(kinds).toEqual(["proposal", "oracle_observation", "reconcile", "checkpoint"]);

    const transitions = world.coordinator.transitionsForRun(world.runId);
    expect(transitions.map((transition) => transition.to)).toEqual(["disorder", "act"]);
  });
});

describe("R5 invalid-action recovery", () => {
  it("escalates to chaos after repeated invalid actions", () => {
    const world = givenStartedRun();
    world.coordinator.processTurn(world.runId, "bad-action-1", { forceReject: true });
    world.coordinator.processTurn(world.runId, "bad-action-2", { forceReject: true });
    world.coordinator.processTurn(world.runId, "bad-action-3", { forceReject: true });

    const transitions = world.coordinator.transitionsForRun(world.runId);
    const toPhases = transitions.map((transition) => transition.to);
    expect(toPhases).toContain("test");
    expect(toPhases).toContain("chaos");
  });
});

