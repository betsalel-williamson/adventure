import type { ModelCategory, RunConfig } from "../../packages/contracts/src/index.js";
import { RunCoordinator } from "../../apps/server/src/index.js";

export type RunWorld = {
  coordinator: RunCoordinator;
  runId: string;
  checkpointId?: string;
};

export const createRunConfig = (modelCategory: ModelCategory): RunConfig => ({
  scenarioId: "benchmark-scenario-1",
  modelCategory,
  modelName: `${modelCategory.toLowerCase()}-baseline`,
  seed: 42
});

export const givenStartedRun = (modelCategory: ModelCategory = "SLM"): RunWorld => {
  const coordinator = new RunCoordinator();
  const { runId } = coordinator.startRun(createRunConfig(modelCategory));
  return { coordinator, runId };
};

