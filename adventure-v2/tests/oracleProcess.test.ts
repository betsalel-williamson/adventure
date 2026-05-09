import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { givenStartedRun } from "./steps/runSteps.js";
import { createProcessOracleBridge } from "../apps/server/src/index.js";

const fixtureScriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "oracle-stub.mjs"
);

const processOracle = () =>
  createProcessOracleBridge({
    command: process.execPath,
    args: [fixtureScriptPath]
  });

describe("process OracleBridge", () => {
  it("maps stub stdout to oracle observation on the turn envelope", () => {
    const world = givenStartedRun("SLM", processOracle());
    const turn = world.coordinator.processTurn(world.runId, "__PROCESS_ORACLE_LINE__");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs).toBeDefined();
    expect(obs!.payload).toMatchObject({
      rejected: false,
      output: "PROCESS-ORACLE-STUB-LINE"
    });
    expect(turn.reconcile.driftDetected).toBe(false);
  });

  it("returns rejected observation when child prints invalid JSON on success exit", () => {
    const bridge = createProcessOracleBridge({
      command: process.execPath,
      args: ["-e", `console.log("not-json")`]
    });
    const world = givenStartedRun("SLM", bridge);
    const turn = world.coordinator.processTurn(world.runId, "look");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      output: expect.stringMatching(/^\[oracle-process\] malformed response:/)
    });
    expect(turn.reconcile.driftDetected).toBe(true);
  });

  it("returns rejected observation on timeout", () => {
    const bridge = createProcessOracleBridge({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000);"],
      timeoutMs: 50
    });
    const world = givenStartedRun("API", bridge);
    const turn = world.coordinator.processTurn(world.runId, "look");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      output: `[oracle-process] timeout after 50ms`
    });
    expect(turn.reconcile.driftDetected).toBe(true);
  });

  it("passes forceReject through stdin for stub", () => {
    const world = givenStartedRun("LLM", processOracle());
    const turn = world.coordinator.processTurn(world.runId, "x", { forceReject: true });
    expect(turn.reconcile.driftDetected).toBe(true);

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      output: "stub-line: forced reject"
    });
  });
});
