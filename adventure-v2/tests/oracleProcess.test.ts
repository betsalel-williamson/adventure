import { describe, expect, it } from "vitest";
import { givenStartedRun } from "./steps/runSteps.js";
import { createProcessOracleBridge } from "../apps/server/src/index.js";
import { oracleStubPath } from "./fixturePaths.js";

const processOracle = () =>
  createProcessOracleBridge({
    command: process.execPath,
    args: [oracleStubPath]
  });

describe("process OracleBridge", () => {
  it("maps stub stdout to oracle observation on the turn envelope", async () => {
    const world = givenStartedRun("SLM", processOracle());
    const turn = await world.coordinator.processTurn(world.runId, "__PROCESS_ORACLE_LINE__");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs).toBeDefined();
    expect(obs!.payload).toMatchObject({
      rejected: false,
      outcome: "accepted",
      output: "PROCESS-ORACLE-STUB-LINE"
    });
    expect(turn.reconcile.driftDetected).toBe(false);
  });

  it("returns rejected observation when child prints invalid JSON on success exit", async () => {
    const bridge = createProcessOracleBridge({
      command: process.execPath,
      args: ["-e", `console.log("not-json")`]
    });
    const world = givenStartedRun("SLM", bridge);
    const turn = await world.coordinator.processTurn(world.runId, "look");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      outcome: "transport_error",
      output: expect.stringMatching(/^\[oracle-process\] malformed response:/)
    });
    expect(turn.reconcile.driftDetected).toBe(true);
    expect(turn.reconcile.driftClass).toBe("unknown");
    expect(turn.reconcile.evidence?.oracleOutcome).toBe("transport_error");
  });

  it("returns rejected observation on timeout", async () => {
    const bridge = createProcessOracleBridge({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000);"],
      timeoutMs: 50
    });
    const world = givenStartedRun("API", bridge);
    const turn = await world.coordinator.processTurn(world.runId, "look");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      outcome: "transport_error",
      output: `[oracle-process] timeout after 50ms`
    });
    expect(turn.reconcile.driftDetected).toBe(true);
    expect(turn.reconcile.driftClass).toBe("unknown");
  });

  it("passes forceReject through stdin for stub", async () => {
    const world = givenStartedRun("LLM", processOracle());
    const turn = await world.coordinator.processTurn(world.runId, "x", { forceReject: true });
    expect(turn.reconcile.driftDetected).toBe(true);

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs!.payload).toMatchObject({
      rejected: true,
      outcome: "rejected",
      output: "stub-line: forced reject"
    });
  });
});
