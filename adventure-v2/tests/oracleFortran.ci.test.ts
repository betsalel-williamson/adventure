import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { givenStartedRun } from "./steps/runSteps.js";
import { createPersistentFortranOracleBridge } from "../apps/server/src/index.js";
import { repoRootPath } from "./fixturePaths.js";

const adventureBin = join(repoRootPath, "adventure");

const shouldRunFortranOracle =
  process.env.ADV_V2_CI_FORTRAN === "1" && existsSync(adventureBin);

describe.runIf(shouldRunFortranOracle)("Fortran oracle CI bridge", () => {
  it("maps Fortran transcript to oracle observation on the turn envelope", async () => {
    const bridge = createPersistentFortranOracleBridge({
      repoRoot: repoRootPath,
      adventureBinary: adventureBin,
      maxWaitMs: 15_000
    });
    const world = givenStartedRun("SLM", bridge);
    const turn = await world.coordinator.processTurn(world.runId, "east");

    const events = world.coordinator.eventsForRun(world.runId);
    const obs = events.find((e) => e.kind === "oracle_observation");
    expect(obs).toBeDefined();
    expect(obs!.payload).toMatchObject({
      rejected: false,
      output: expect.stringMatching(/WELL HOUSE|END OF A ROAD/i)
    });
    expect(turn.reconcile.driftDetected).toBe(false);
  });

  it("keeps one Fortran process per runId (no inventory reset between turns)", async () => {
    const bridge = createPersistentFortranOracleBridge({
      repoRoot: repoRootPath,
      adventureBinary: adventureBin,
      maxWaitMs: 15_000
    });
    const world = givenStartedRun("SLM", bridge);
    await world.coordinator.processTurn(world.runId, "");
    await world.coordinator.processTurn(world.runId, "east");
    await world.coordinator.processTurn(world.runId, "take lamp");

    const obsEvents = world.coordinator
      .eventsForRun(world.runId)
      .filter((e) => e.kind === "oracle_observation");
    const last = obsEvents.at(-1)!;
    expect(last.payload).toMatchObject({ rejected: false });
    const out = (last.payload as { output: string }).output;
    expect(out).not.toMatch(/I SEE NO LAMP HERE/i);
  });
});
