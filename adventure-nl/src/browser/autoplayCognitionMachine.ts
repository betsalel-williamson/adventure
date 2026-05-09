/**
 * Browser autoplay cognition orchestrator (ADR0005 / ADR0016).
 * XState v5 setup machine: SSE-driven turn sequence, optional Glue MCP ping, client-direct planning.
 */
import type { AdventureDatabase } from "@adventure-nl/nl-glue";
import type { AutoplayPlannerResponse } from "@adventure-nl/nl-glue";
import {
  AutoplaySessionMemory,
  buildAutoplayPlannerInvocation,
  gameOutputLooksLikePlayAgainPrompt,
  planAfterAutoplayGuards,
  plannerToScriptedGetin,
  type AutoplayUiSnapshot,
} from "@adventure-nl/nl-glue";
import { deserializeAdventureDatabaseFromJson } from "../dat/adventureDatabaseJson.js";
import { resolveAutoplayContextChars } from "../nl/autoplayThrottle.js";
import {
  planAutoplayInBrowser,
  type BrowserPlannerCredentialsPayload,
} from "../nl/browserPlanAutoplay.js";
import {
  assign,
  createActor,
  fromPromise,
  setup,
  type InspectionEvent,
  type Observer,
} from "xstate";
import type { GlueMcpWorkerHost } from "./glueMcp/glueMcpWorkerHost.js";

const MAX_RECENT_EVENTS = 20;

export type PlannerSnapshot = {
  readonly providerId: string;
  readonly modelId: string;
  readonly browserPlanner: Record<string, unknown> | null;
};

/** Bundle shape loaded from `browserAutoplayCognition.js` (same as cognitionBundle exports used by actors). */
export type BrowserAutoplayCognitionMod = {
  readonly deserializeAdventureDatabaseFromJson: typeof deserializeAdventureDatabaseFromJson;
  readonly AutoplaySessionMemory: typeof AutoplaySessionMemory;
  readonly resolveAutoplayContextChars: typeof resolveAutoplayContextChars;
  readonly gameOutputLooksLikePlayAgainPrompt: typeof gameOutputLooksLikePlayAgainPrompt;
  readonly buildAutoplayPlannerInvocation: typeof buildAutoplayPlannerInvocation;
  readonly planAutoplayInBrowser: typeof planAutoplayInBrowser;
  readonly planAfterAutoplayGuards: typeof planAfterAutoplayGuards;
  readonly plannerToScriptedGetin: typeof plannerToScriptedGetin;
};

export type BrowserAutoplayCognitionInput = {
  readonly loadCognitionModule: () => Promise<BrowserAutoplayCognitionMod>;
  readonly getAdventureDatabase: () => Promise<Response>;
  readonly postEngineInput: (
    body: Record<string, unknown>,
  ) => Promise<Response>;
  readonly getPlannerSnapshot: () => Promise<PlannerSnapshot>;
  readonly getPlannerOverrides: () => Promise<{
    getPlannerPromptExperiment: () => Record<string, unknown>;
  }>;
  readonly applySnapshot: (snap: AutoplayUiSnapshot) => void;
  readonly glueMcpHost: GlueMcpWorkerHost | null;
  readonly useGlueMcp: boolean;
};

type PendingPrompt = {
  readonly transcriptSoFar: string;
  readonly phase: "first" | "continue";
  readonly gameOutputSinceLastCommand: string;
};

type PlanResult = {
  readonly plan: AutoplayPlannerResponse;
  readonly getinLine: string;
};

export type BrowserAutoplayCognitionContext = {
  readonly ports: BrowserAutoplayCognitionInput;
  pendingPrompt: PendingPrompt | null;
  lastGetinLine: string;
  moveNumber: number;
  lastError: string | null;
  recentEvents: readonly { readonly type: string; readonly summary: string }[];
  db: AdventureDatabase | null;
  memory: InstanceType<typeof AutoplaySessionMemory> | null;
  contextChars: number;
  bundle: BrowserAutoplayCognitionMod | null;
  plannerSnap: PlannerSnapshot | null;
  plannedGetinLine: string | null;
  plannedPlan: AutoplayPlannerResponse | null;
};

export type BrowserAutoplayCognitionEvent = {
  type: "ENGINE.GETIN_PROMPT_READY";
  transcriptSoFar: string;
  phase?: string;
  gameOutputSinceLastCommand?: string;
};

function pushEvent(
  events: BrowserAutoplayCognitionContext["recentEvents"],
  type: string,
  summary: string,
): readonly { readonly type: string; readonly summary: string }[] {
  const next = [...events, { type, summary }];
  return next.length > MAX_RECENT_EVENTS
    ? next.slice(next.length - MAX_RECENT_EVENTS)
    : next;
}

function plannerCredentialsReady(
  providerId: string,
  bp: Record<string, unknown> | null,
): boolean {
  if (!bp || typeof bp !== "object") return false;
  if (providerId === "google") {
    return typeof bp.googleApiKey === "string" && bp.googleApiKey.length > 0;
  }
  if (providerId === "http") {
    return typeof bp.httpBaseUrl === "string" && bp.httpBaseUrl.length > 0;
  }
  return false;
}

function summarizeEvent(ev: BrowserAutoplayCognitionEvent): string {
  const ph = ev.phase === "first" || ev.phase === "continue" ? ev.phase : "?";
  const tlen =
    typeof ev.transcriptSoFar === "string" ? ev.transcriptSoFar.length : 0;
  return `phase=${ph} transcriptLen=${tlen}`;
}

const loadCognitionActor = fromPromise(
  async ({
    input,
  }: {
    input: BrowserAutoplayCognitionInput;
  }): Promise<{
    db: AdventureDatabase;
    contextChars: number;
    bundle: BrowserAutoplayCognitionMod;
  }> => {
    const r = await input.getAdventureDatabase();
    if (!r.ok) throw new Error("Could not load adventure database snapshot");
    const j = (await r.json()) as { database?: unknown };
    const mod = await input.loadCognitionModule();
    const db = mod.deserializeAdventureDatabaseFromJson(j.database);
    const contextChars = mod.resolveAutoplayContextChars();
    return { db, contextChars, bundle: mod };
  },
);

const glueOptionalActor = fromPromise(
  async ({
    input,
  }: {
    input: BrowserAutoplayCognitionInput;
  }): Promise<{ ok: boolean; detail: string }> => {
    if (!input.useGlueMcp || !input.glueMcpHost) {
      return { ok: true, detail: "glue_mcp_skipped" };
    }
    const listed = await input.glueMcpHost.toolsList();
    return { ok: true, detail: `tools_list_count=${listed.tools.length}` };
  },
);

const resolvePlannerActor = fromPromise(
  async ({
    input,
  }: {
    input: BrowserAutoplayCognitionInput;
  }): Promise<PlannerSnapshot> => input.getPlannerSnapshot(),
);

const planAutoplayActor = fromPromise(
  async ({
    input,
    signal,
  }: {
    input: {
      cognition: BrowserAutoplayCognitionInput;
      ctx: BrowserAutoplayCognitionContext;
    };
    signal: AbortSignal;
  }): Promise<PlanResult> => {
    void signal;
    const { cognition, ctx } = input;
    const db = ctx.db;
    const memory = ctx.memory;
    const bundle = ctx.bundle;
    const pending = ctx.pendingPrompt;
    const plannerSnap = ctx.plannerSnap;
    if (!db || !memory || !bundle || !pending || !plannerSnap) {
      throw new Error("planAutoplayActor: missing context");
    }
    if (
      plannerSnap.providerId !== "google" &&
      plannerSnap.providerId !== "http"
    ) {
      throw new Error(`Unsupported provider: ${plannerSnap.providerId}`);
    }
    const overrides = await cognition.getPlannerOverrides();
    const inv = bundle.buildAutoplayPlannerInvocation({
      db,
      memory,
      contextChars: ctx.contextChars,
      providerId: plannerSnap.providerId,
      recentForRepairRaw:
        pending.phase === "first"
          ? pending.transcriptSoFar
          : pending.gameOutputSinceLastCommand,
      overrides,
    });
    let plan = await bundle.planAutoplayInBrowser(
      db,
      {
        plannerUserPrompt: inv.plannerUserPrompt,
        recentGameTextForRepair: inv.recentGameTextForRepair,
        includeDatHelpInSystem: inv.includeDatHelpInSystem,
      },
      {
        providerId: plannerSnap.providerId,
        modelId: plannerSnap.modelId,
        browserPlanner:
          plannerSnap.browserPlanner as BrowserPlannerCredentialsPayload,
      },
    );
    plan = bundle.planAfterAutoplayGuards(memory, plan, () => {});
    const scripted = bundle.plannerToScriptedGetin(plan);
    const getinLine = typeof scripted === "string" ? scripted : scripted.line;
    return { plan, getinLine };
  },
);

const submitGetinActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      cognition: BrowserAutoplayCognitionInput;
      getinLine: string;
      plan: AutoplayPlannerResponse;
      moveNumber: number;
    };
  }): Promise<void> => {
    const { cognition, getinLine, plan, moveNumber } = input;
    const er = await cognition.postEngineInput({
      getinLine,
      plan,
      moveNumber,
      motionGridHint: null,
    });
    if (!er.ok) throw new Error("engine input failed");
  },
);

export const browserAutoplayOrchestratorLogic = setup({
  types: {
    context: {} as BrowserAutoplayCognitionContext,
    events: {} as BrowserAutoplayCognitionEvent,
    input: {} as BrowserAutoplayCognitionInput,
  },
  actors: {
    loadCognition: loadCognitionActor,
    glueOptional: glueOptionalActor,
    resolvePlanner: resolvePlannerActor,
    planAutoplay: planAutoplayActor,
    submitGetin: submitGetinActor,
  },
  actions: {
    assignPromptFromEvent: assign(({ context, event }) => {
      if (event.type !== "ENGINE.GETIN_PROMPT_READY") return {};
      const phase =
        event.phase === "first" || event.phase === "continue"
          ? event.phase
          : "continue";
      const gameOutputSinceLastCommand =
        typeof event.gameOutputSinceLastCommand === "string"
          ? event.gameOutputSinceLastCommand
          : "";
      const pending: PendingPrompt = {
        transcriptSoFar: event.transcriptSoFar,
        phase,
        gameOutputSinceLastCommand,
      };
      return {
        pendingPrompt: pending,
        lastError: null,
        recentEvents: pushEvent(
          context.recentEvents,
          event.type,
          summarizeEvent(event),
        ),
      };
    }),
    assignHydrationDone: assign(({ event }) => {
      if (!("output" in event) || event.output === undefined) return {};
      const out = event.output as {
        db: AdventureDatabase;
        contextChars: number;
        bundle: BrowserAutoplayCognitionMod;
      };
      return {
        db: out.db,
        contextChars: out.contextChars,
        bundle: out.bundle,
      };
    }),
    ensureMemoryInstance: assign(({ context }) => {
      if (context.memory) return {};
      if (!context.bundle) return {};
      return { memory: new context.bundle.AutoplaySessionMemory() };
    }),
    ingestMemoryFromPending: ({ context }) => {
      const bundle = context.bundle;
      const memory = context.memory;
      const pending = context.pendingPrompt;
      const db = context.db;
      if (!bundle || !memory || !pending || !db) return;
      if (pending.phase === "first") {
        memory.seedOpening(pending.transcriptSoFar, { adventureDb: db });
      } else if (context.lastGetinLine.length > 0) {
        memory.recordCommandOutcome(
          context.lastGetinLine,
          pending.gameOutputSinceLastCommand,
          { adventureDb: db },
        );
      }
    },
    assignPlannerResult: assign(({ event }) => {
      if (!("output" in event) || event.output === undefined) return {};
      return { plannerSnap: event.output as PlannerSnapshot };
    }),
    assignGlueDetail: assign(({ context, event }) => {
      const detail =
        "output" in event &&
        event.output !== undefined &&
        typeof event.output === "object" &&
        event.output !== null &&
        "detail" in event.output
          ? String((event.output as { detail: string }).detail)
          : "ok";
      return {
        recentEvents: pushEvent(context.recentEvents, "glue.optional", detail),
      };
    }),
    assignPlanDone: assign(({ context, event }) => {
      if (!("output" in event) || event.output === undefined) return {};
      const { plan, getinLine } = event.output as PlanResult;
      const nextMove = context.moveNumber + 1;
      return {
        moveNumber: nextMove,
        plannedPlan: plan,
        plannedGetinLine: getinLine,
        recentEvents: pushEvent(
          context.recentEvents,
          "plan.done",
          `getinLen=${getinLine.length}`,
        ),
      };
    }),
    applySnapshotAfterSubmit: ({ context }) => {
      const memory = context.memory;
      if (!memory) return;
      const uiSnap = memory.buildAutoplayUiSnapshot();
      context.ports.applySnapshot(uiSnap);
    },
    assignSubmitDone: assign(({ context }) => {
      const line = context.plannedGetinLine ?? "";
      return {
        lastGetinLine: line,
        plannedGetinLine: null,
        plannedPlan: null,
        recentEvents: pushEvent(
          context.recentEvents,
          "engine.getin_sent",
          `len=${line.length}`,
        ),
      };
    }),
    assignPlayAgainSubmit: assign(({ context }) => ({
      moveNumber: context.moveNumber + 1,
      lastGetinLine: "Y",
      recentEvents: pushEvent(context.recentEvents, "engine.play_again", "Y"),
    })),
    assignError: assign(({ context, event }) => {
      const errUnknown =
        event && typeof event === "object" && "error" in event
          ? (event as { error: unknown }).error
          : undefined;
      const msg =
        errUnknown instanceof Error
          ? errUnknown.message
          : String(errUnknown ?? "unknown_error");
      const short = msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
      return {
        lastError: short,
        recentEvents: pushEvent(context.recentEvents, "error", short),
      };
    }),
    logMlxError: assign(({ context }) => ({
      lastError: "mlx_provider_unsupported_for_browser_planning",
      recentEvents: pushEvent(
        context.recentEvents,
        "planner.mlx_blocked",
        "use google or http",
      ),
    })),
    logNoCreds: assign(({ context }) => ({
      lastError: "missing_browser_planner_credentials",
      recentEvents: pushEvent(
        context.recentEvents,
        "planner.no_credentials",
        "need SSE or GET /api/text-llm",
      ),
    })),
  },
  guards: {
    playAgainFromPending: ({ context }) => {
      const bundle = context.bundle;
      const pending = context.pendingPrompt;
      if (!bundle || !pending) return false;
      return bundle.gameOutputLooksLikePlayAgainPrompt(
        pending.gameOutputSinceLastCommand,
      );
    },
    isMlxPlanner: ({ context }) => context.plannerSnap?.providerId === "mlx",
    plannerCredsMissing: ({ context }) => {
      const s = context.plannerSnap;
      if (!s) return true;
      return !plannerCredentialsReady(s.providerId, s.browserPlanner);
    },
  },
}).createMachine({
  id: "browserAutoplayCognition",
  context: ({ input }: { input: BrowserAutoplayCognitionInput }) => ({
    ports: input,
    pendingPrompt: null,
    lastGetinLine: "",
    moveNumber: 0,
    lastError: null,
    recentEvents: [],
    db: null,
    memory: null,
    contextChars: 6000,
    bundle: null,
    plannerSnap: null,
    plannedGetinLine: null,
    plannedPlan: null,
  }),
  initial: "idle",
  on: {
    "ENGINE.GETIN_PROMPT_READY": {
      target: ".hydrating",
      actions: "assignPromptFromEvent",
      reenter: true,
    },
  },
  states: {
    idle: {},
    hydrating: {
      invoke: {
        src: "loadCognition",
        input: ({ context }) => context.ports,
        onDone: {
          target: "ingestingMemory",
          actions: ["assignHydrationDone", "ensureMemoryInstance"],
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
    ingestingMemory: {
      entry: "ingestMemoryFromPending",
      always: [
        {
          guard: "playAgainFromPending",
          target: "submittingPlayAgain",
        },
        { target: "glueOptional" },
      ],
    },
    glueOptional: {
      invoke: {
        src: "glueOptional",
        input: ({ context }) => context.ports,
        onDone: {
          target: "resolvingPlanner",
          actions: "assignGlueDetail",
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
    resolvingPlanner: {
      invoke: {
        src: "resolvePlanner",
        input: ({ context }) => context.ports,
        onDone: {
          target: "validatingPlanner",
          actions: "assignPlannerResult",
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
    validatingPlanner: {
      always: [
        {
          guard: "isMlxPlanner",
          target: "idle",
          actions: "logMlxError",
        },
        {
          guard: "plannerCredsMissing",
          target: "idle",
          actions: "logNoCreds",
        },
        { target: "planning" },
      ],
    },
    planning: {
      invoke: {
        src: "planAutoplay",
        input: ({ context }) => ({
          cognition: context.ports,
          ctx: context,
        }),
        onDone: {
          target: "submittingGetin",
          actions: "assignPlanDone",
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
    submittingGetin: {
      invoke: {
        src: "submitGetin",
        input: ({ context }) => {
          const plan = context.plannedPlan;
          const line = context.plannedGetinLine;
          if (!plan || line === null) {
            throw new Error("submitGetin: missing plan");
          }
          return {
            cognition: context.ports,
            getinLine: line,
            plan,
            moveNumber: context.moveNumber,
          };
        },
        onDone: {
          target: "idle",
          actions: ["applySnapshotAfterSubmit", "assignSubmitDone"],
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
    submittingPlayAgain: {
      invoke: {
        src: "submitGetin",
        input: ({ context }) => {
          const line = "Y";
          const plan = {
            primaryToken: "Y",
            continuePlaying: true,
          } as AutoplayPlannerResponse;
          return {
            cognition: context.ports,
            getinLine: line,
            plan,
            moveNumber: context.moveNumber + 1,
          };
        },
        onDone: {
          target: "idle",
          actions: "assignPlayAgainSubmit",
        },
        onError: {
          target: "idle",
          actions: "assignError",
        },
      },
    },
  },
});

/**
 * Starts the root cognition actor with orchestration ports (browser dashboard).
 */
export function createBrowserAutoplayCognitionActor(
  input: BrowserAutoplayCognitionInput,
  options?: {
    inspect?:
      | Observer<InspectionEvent>
      | ((inspectionEvent: InspectionEvent) => void);
  },
) {
  const actor = createActor(browserAutoplayOrchestratorLogic, {
    input,
    inspect: options?.inspect,
  });
  actor.start();
  return actor;
}
