/**
 * Orchestrator machine tests. Planner/vendor HTTP is not exercised here;
 * `planAutoplayInBrowser` is mocked; integration tests can add MSW at the
 * `fetch` port when the orchestrator is fully TypeScript-bound.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("xstate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xstate")>();
  return {
    ...actual,
    createActor: vi.fn((machine, options) =>
      actual.createActor(machine, options),
    ),
  };
});

import { createActor } from "xstate";
import type { AdventureDatabase } from "@adventure-nl/nl-glue";
import type { AutoplayPlannerResponse } from "@adventure-nl/nl-glue";
import type { AutoplayUiSnapshot } from "@adventure-nl/nl-glue";
import {
  browserAutoplayOrchestratorLogic,
  createBrowserAutoplayCognitionActor,
  type BrowserAutoplayCognitionInput,
  type BrowserAutoplayCognitionMod,
} from "./autoplayCognitionMachine.js";
import type { GlueMcpWorkerHost } from "./glueMcp/glueMcpWorkerHost.js";

const fakeDb = {} as AdventureDatabase;

const stubInvocation = {
  plannerUserPrompt: { system: "s", user: "u" } as const,
  recentGameTextForRepair: "",
  includeDatHelpInSystem: true,
  useMxStructuredSplit: false,
  compact: true,
  structuredDashboard: false,
};

const emptyUiSnapshot: AutoplayUiSnapshot = {
  locationHint: "",
  inventory: [],
  objectNotes: [],
  map: {} as AutoplayUiSnapshot["map"],
  mapMermaid: "",
  mapDot: "",
  nullCommandKeysAtCurrentNode: [],
  stagnating: false,
  recentTurns: [],
  tryNextLine: "",
};

function mockMemoryCtor() {
  return class {
    seedOpening = vi.fn();
    recordCommandOutcome = vi.fn();
    buildAutoplayUiSnapshot = vi.fn(() => emptyUiSnapshot);
  };
}

function minimalMod(
  overrides: Partial<BrowserAutoplayCognitionMod> = {},
): BrowserAutoplayCognitionMod {
  return {
    deserializeAdventureDatabaseFromJson: vi.fn(() => fakeDb),
    AutoplaySessionMemory:
      mockMemoryCtor() as unknown as typeof import("@adventure-nl/nl-glue").AutoplaySessionMemory,
    resolveAutoplayContextChars: vi.fn(() => 6000),
    gameOutputLooksLikePlayAgainPrompt: vi.fn(() => false),
    buildAutoplayPlannerInvocation: vi.fn(() => stubInvocation),
    planAutoplayInBrowser: vi.fn(async () => ({
      primaryToken: "NORTH",
      continuePlaying: true,
    })),
    planAfterAutoplayGuards: vi.fn((_m, p) => p),
    plannerToScriptedGetin: vi.fn(() => "NORTH"),
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<BrowserAutoplayCognitionInput> = {},
): BrowserAutoplayCognitionInput {
  const mod = minimalMod();
  return {
    loadCognitionModule: vi.fn(async () => mod),
    getAdventureDatabase: vi.fn(async () => {
      return new Response(JSON.stringify({ database: {} }), { status: 200 });
    }),
    postEngineInput: vi.fn(async () => new Response(null, { status: 200 })),
    getPlannerSnapshot: vi.fn(async () => ({
      providerId: "google",
      modelId: "gemini",
      browserPlanner: { googleApiKey: "test-key" },
    })),
    getPlannerOverrides: vi.fn(async () => ({
      getPlannerPromptExperiment: () => ({}),
    })),
    applySnapshot: vi.fn(),
    glueMcpHost: null,
    useGlueMcp: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("browserAutoplayOrchestratorLogic", () => {
  it("runs through planning and submits GETIN (google provider)", async () => {
    const mod = minimalMod();
    const input = baseInput({
      loadCognitionModule: vi.fn(async () => mod),
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "You are in a room.",
      phase: "first",
      gameOutputSinceLastCommand: "",
    });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches("idle")).toBe(true);
    });
    const snap = actor.getSnapshot().context;
    expect(snap.moveNumber).toBe(1);
    expect(snap.lastGetinLine).toBe("NORTH");
    expect(input.postEngineInput).toHaveBeenCalled();
    expect(input.applySnapshot).toHaveBeenCalled();
  });

  it("stays idle with mlx provider after planner resolution", async () => {
    const input = baseInput({
      getPlannerSnapshot: vi.fn(async () => ({
        providerId: "mlx",
        modelId: "local",
        browserPlanner: null,
      })),
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "x",
      phase: "first",
    });
    await vi.waitFor(() => {
      const err = actor.getSnapshot().context.lastError;
      expect(err).not.toBeNull();
      expect(String(err).toLowerCase()).toContain("mlx");
    });
    expect(input.postEngineInput).not.toHaveBeenCalled();
  });

  it("handles play-again branch without calling planner", async () => {
    const mod = minimalMod({
      gameOutputLooksLikePlayAgainPrompt: vi.fn(() => true),
    });
    const input = baseInput({
      loadCognitionModule: vi.fn(async () => mod),
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "t",
      phase: "continue",
      gameOutputSinceLastCommand: "Do you want to play again?",
    });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.lastGetinLine).toBe("Y");
    });
    expect(mod.planAutoplayInBrowser).not.toHaveBeenCalled();
    expect(input.postEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({ getinLine: "Y" }),
    );
  });

  it("records error when engine rejects GETIN", async () => {
    const input = baseInput({
      postEngineInput: vi.fn(async () => new Response("bad", { status: 400 })),
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "x",
      phase: "first",
    });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().context.lastError).not.toBeNull();
    });
  });

  it("calls Glue MCP tools/list when useGlueMcp is true", async () => {
    const toolsList = vi.fn().mockResolvedValue({
      tools: [{ name: "map_current_state" }],
    });
    const glueMcpHost = { toolsList } as unknown as GlueMcpWorkerHost;
    const mod = minimalMod();
    const input = baseInput({
      loadCognitionModule: vi.fn(async () => mod),
      useGlueMcp: true,
      glueMcpHost,
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "x",
      phase: "first",
    });
    await vi.waitFor(() => expect(toolsList).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(actor.getSnapshot().matches("idle")).toBe(true),
    );
  });

  it("re-enters hydrating on a second prompt while planning", async () => {
    let resolvePlan: ((p: AutoplayPlannerResponse) => void) | undefined;
    const planPromise = new Promise<AutoplayPlannerResponse>((r) => {
      resolvePlan = r;
    });
    const mod = minimalMod({
      planAutoplayInBrowser: vi.fn(() => planPromise),
    });
    const input = baseInput({
      loadCognitionModule: vi.fn(async () => mod),
    });
    const actor = createActor(browserAutoplayOrchestratorLogic, {
      input,
    }).start();
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "a",
      phase: "first",
    });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches("planning")).toBe(true);
    });
    actor.send({
      type: "ENGINE.GETIN_PROMPT_READY",
      transcriptSoFar: "b",
      phase: "continue",
      gameOutputSinceLastCommand: "out",
    });
    resolvePlan?.({
      primaryToken: "SOUTH",
      continuePlaying: true,
    });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches("idle")).toBe(true);
    });
  });
});

describe("createBrowserAutoplayCognitionActor", () => {
  it("passes inspect into xstate createActor when provided", () => {
    const inspectObserver = vi.fn();
    const input = baseInput();
    const actor = createBrowserAutoplayCognitionActor(input, {
      inspect: inspectObserver,
    });

    const mockedCreateActor = vi.mocked(createActor);
    expect(mockedCreateActor).toHaveBeenCalled();
    const lastCall =
      mockedCreateActor.mock.calls[mockedCreateActor.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe(browserAutoplayOrchestratorLogic);
    expect(lastCall?.[1]).toMatchObject({
      input,
      inspect: inspectObserver,
    });

    actor.stop();
  });
});
