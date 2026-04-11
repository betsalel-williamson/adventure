#!/usr/bin/env node
/**
 * Local HTTP dashboard for autoplay: static HTML/JS + SSE stream of game text,
 * planner phases, heuristic map/inventory, prompt previews, and optional manual GETIN.
 */
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { loadDatFile } from "../dat/loadDat.js";
import {
  interpretWithTextLlm,
  resolveTextLlmFromEnv,
} from "../nl/adventureTextLlm.js";
import { shouldFallbackToClassicForLlmError } from "../nl/llmErrors.js";
import {
  resolveDebugLogPath,
  runWithWebDashboardLlmLogContext,
} from "../nl/llmDebug.js";
import {
  isAllowedMlxWebModelId,
  mlxWebModelPresetsList,
} from "../nl/mlxModelPresets.js";
import { MlxLmStdioTextLlm } from "../nl/providers/mlxLmStdioTextLlm.js";
import {
  defaultPromptExperimentPatch,
  patchPromptExperimentPatch,
  type PromptExperimentPatch,
} from "../nl/promptExperiment.js";
import { interpretedToGetinLine, swapInterpretedTokens } from "../nl/schema.js";
import { buildVerbSynonymGroups } from "../vocab/verbSynonymGroups.js";
import type { TextLlm, TextLlmProviderId } from "../nl/textLlmContract.js";
import { buildLlmPackagingDiscoveryPayload } from "../nl/llmPackagingProfile.js";
import {
  buildTextLlmBackendSnapshots,
  canSwapTextLlmFromBackends,
} from "../nl/textLlmWebBackends.js";
import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";
import { resolveAutoplayPromptMode } from "../nl/adventureNlPrompts.js";
import {
  runAutoplaySessionWithTextLlm,
  AUTOPLAY_RESUME_PLANNER,
  resolveAutoplayMaxMoves,
  resolveAutoplayPaceMs,
  type AutoplayManualPlannerGate,
  type AutoplayRunOverrides,
  type AutoplayUiSink,
} from "./autoplayRunner.js";
import { resolveBrowserOrchestratedAutoplayFromEnv } from "./browserOrchestrationEnv.js";
import { runBrowserOrchestratedEngineSession } from "./browserEngineBridge.js";
import { EngineGetinQueue } from "./engineGetinQueue.js";
import { serializeAdventureDatabaseToJson } from "../dat/adventureDatabaseJson.js";
import { planAutoplayWithTextLlm } from "../nl/adventureTextLlm.js";
import { AutoplayPlannerResponseSchema } from "../nl/schema.js";
import type { PlannerUserPromptInput } from "../nl/textLlmContract.js";
import {
  listAutoplayStrategyIds,
  resolveAutoplayStrategyHooks,
} from "./autoplayStrategyRegistry.js";
import {
  insertBenchmarkRunRow,
  openBenchmarkRunsDb,
  queryBenchmarkLeaderboard,
  type BenchmarkRunConfigJson,
  type BenchmarkRunMetricsJson,
} from "./benchmarkRunsDb.js";
import { collectHostRuntimeInfo } from "./hostRuntimeInfo.js";
import { readGitWorktreeMeta } from "./gitWorktreeMeta.js";
import {
  applyAllowlistedEnvToProcess,
  mergeEnvAllowlists,
  restoreEnvFromBackup,
  sanitizePromptProjectEnvAllowlist,
  type EnvBackup,
} from "./promptProjectEnvAllowlist.js";
import {
  deletePromptProject,
  listPromptProjects,
  newPromptProjectId,
  readPromptProject,
  resolvePromptProjectsDir,
  upgradePromptProjectToLatest,
  writePromptProject,
  PROMPT_PROJECT_SCHEMA_LATEST,
  type PromptProjectRecord,
} from "./promptProjectsStore.js";
import {
  applyGenerationParamsPatch,
  buildGenerationParamsSnapshot,
  snapshotGenerationMeta,
} from "./webDashboardGeneration.js";
import {
  appendSessionSetCookieHeader,
  formatSessionSetCookie,
  isValidSessionId,
  parseAdventureSessionCookie,
} from "./webDashboardSession.js";
import {
  createLlmSequentialExecutor,
  createQueuedTextLlm,
} from "./webDashboardLlmQueue.js";
import {
  WebDashboardTextLlmPool,
  poolKey,
  resolveWebMaxLoadedModels,
} from "./webDashboardTextLlmPool.js";
import {
  httpsServerOptionsFromTls,
  isWebDashboardInsecureHttp,
  resolveWebDashboardTls,
} from "./webDashboardTls.js";

const packageRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const envPaths = [
  path.join(packageRoot, ".env.local"),
  path.join(packageRoot, ".env"),
].filter((p) => existsSync(p));
if (envPaths.length > 0) {
  loadEnv({
    path: envPaths.length === 1 ? envPaths[0]! : envPaths,
    override: true,
    quiet: true,
  });
}

const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");
const adventureBin = path.join(repoRoot, "adventure");
const publicDir = path.join(packageRoot, "public");

function resolveWebPort(): number {
  const v = process.env.ADVENTURE_LLM_WEB_PORT?.trim();
  if (v === undefined || v === "") return 8787;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? Math.floor(n) : 8787;
}

async function ensureMlxWorkerReady(client: TextLlm): Promise<void> {
  if (!(client instanceof MlxLmStdioTextLlm)) return;
  process.stderr.write("adventure-llm: loading MLX model (one-time)…\n");
  await client.preloadWorker();
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function sseWrite(
  res: http.ServerResponse,
  event: string,
  payload: unknown,
): void {
  const data = JSON.stringify(payload);
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const ch of req) {
    chunks.push(ch as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw === "") return null;
  return JSON.parse(raw) as unknown;
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function jsonResponseWithSessionCookie(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  cookie: { isNew: boolean; sessionId: string; secureCookies: boolean },
): void {
  if (cookie.isNew) {
    appendSessionSetCookieHeader(res, cookie.sessionId, {
      secure: cookie.secureCookies,
    });
  }
  jsonResponse(res, status, body);
}

type ManualPending = {
  resolve: (
    v: ScriptedGetinLine | null | typeof AUTOPLAY_RESUME_PLANNER,
  ) => void;
  intervalId: ReturnType<typeof setInterval>;
};

export type DashboardCreateOptions = {
  readonly secureCookies: boolean;
  readonly httpsOptions?: https.ServerOptions;
};

type DashboardSession = {
  readonly id: string;
  readonly clients: Set<http.ServerResponse>;
  readonly broadcast: (event: string, payload: unknown) => void;
  /** Browser-orchestrated GETIN submissions (ADR0005). */
  readonly engineGetinQueue: EngineGetinQueue;
  autoplayRunning: Promise<void> | null;
  autoplayStartScheduled: boolean;
  plannerAutoplayEnabled: boolean;
  webAutoplayOverrides: AutoplayRunOverrides;
  webPromptExperiment: PromptExperimentPatch;
  activePromptProjectId: string | null;
  activeStrategyId: string;
  promptProjectEnvBackup: EnvBackup;
  readonly benchmarkMeta: {
    teamName: string | null;
    tags: readonly string[];
  };
  flushBenchmarkRun: (
    status: "completed" | "failed" | "aborted",
    failureReason: string | null,
  ) => void;
  readonly webAutoplayLiveOverrides: AutoplayRunOverrides;
  latestTranscript: string;
  engineLogLineBuffer: string;
  manualPending: ManualPending | null;
  manualPlannerGate: AutoplayManualPlannerGate;
  sink: AutoplayUiSink;
  readonly textLlmSource: { current: TextLlm };
  textLlmProviderId: TextLlmProviderId;
  textLlmModelId: string;
  poolAttachedKey: string | null;
};

export function createAutoplayDashboardServer(
  options: DashboardCreateOptions,
): http.Server | https.Server {
  const llmExecutor = createLlmSequentialExecutor();
  const sessions = new Map<string, DashboardSession>();

  const broadcastAll = (event: string, payload: unknown): void => {
    for (const s of sessions.values()) {
      s.broadcast(event, payload);
    }
  };

  let mlxSwapChain: Promise<void> = Promise.resolve();

  /** Resolved until {@link beginMlxModelLoad}; autoplay and NL interpret await this. */
  let mlxLoadBarrier: Promise<void> = Promise.resolve();
  let resolveMlxLoadBarrier: (() => void) | null = null;

  let mlxLoadUiActive = false;

  /** Set while `preloadWorker` runs for a new MLX client during a pool load (cancellable). */
  const mlxUiRefs = {
    swapInFlight: null as MlxLmStdioTextLlm | null,
    loadCancelled: false,
  };

  const beginMlxModelLoad = (opts?: { canCancel?: boolean }): void => {
    mlxLoadUiActive = true;
    mlxLoadBarrier = new Promise<void>((resolve) => {
      resolveMlxLoadBarrier = resolve;
    });
    broadcastAll("mlx_loading", {
      loading: true,
      message: "Loading MLX model…",
      resetProgress: true,
      canCancel: opts?.canCancel === true,
    });
  };

  const endMlxModelLoad = (): void => {
    mlxLoadUiActive = false;
    resolveMlxLoadBarrier?.();
    resolveMlxLoadBarrier = null;
    mlxLoadBarrier = Promise.resolve();
    broadcastAll("mlx_loading", { loading: false });
  };

  const awaitMlxModelReady = async (): Promise<void> => {
    await mlxLoadBarrier;
  };

  const runMlxSwap = async (fn: () => Promise<void>): Promise<void> => {
    const previous = mlxSwapChain;
    let release!: () => void;
    mlxSwapChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    await llmExecutor.flush();
    try {
      await fn();
    } finally {
      release();
    }
  };

  const envTextLlm = resolveTextLlmFromEnv();
  const textLlmConfigured = envTextLlm !== null;
  const defaultTextLlmSelection = envTextLlm
    ? { providerId: envTextLlm.providerId, modelId: envTextLlm.modelId }
    : null;
  if (envTextLlm instanceof MlxLmStdioTextLlm) {
    void envTextLlm.dispose().catch(() => {
      /* ignore */
    });
  }

  const pool: WebDashboardTextLlmPool | null = textLlmConfigured
    ? new WebDashboardTextLlmPool(resolveWebMaxLoadedModels(), {
        runSerialized: runMlxSwap,
        broadcastAll,
        broadcastOneSession: (sessionId, ev, p) => {
          const se = sessions.get(sessionId);
          if (se) se.broadcast(ev, p);
        },
        detachSessionsFromPoolKey: (key) => {
          for (const s of sessions.values()) {
            if (s.poolAttachedKey === key) {
              s.poolAttachedKey = null;
            }
          }
        },
        beginMlxModelLoad,
        endMlxModelLoad,
        mlxSwapInFlight: {
          get current() {
            return mlxUiRefs.swapInFlight;
          },
          set current(v: MlxLmStdioTextLlm | null) {
            mlxUiRefs.swapInFlight = v;
          },
        },
        mlxLoadCancelled: {
          get current() {
            return mlxUiRefs.loadCancelled;
          },
          set current(v: boolean) {
            mlxUiRefs.loadCancelled = v;
          },
        },
      })
    : null;

  if (pool !== null) {
    process.stderr.write(
      `adventure-llm: dashboard text model pool capacity: ${resolveWebMaxLoadedModels()} (ADVENTURE_LLM_WEB_MAX_LOADED_MODELS)\n`,
    );
  }

  const broadcastSessionTextLlm = (s: DashboardSession): void => {
    s.broadcast("text_llm", {
      providerId: s.textLlmProviderId,
      modelId: s.textLlmModelId,
    });
    s.broadcast("mlx_model", {
      modelId: s.textLlmModelId,
      providerId: s.textLlmProviderId,
    });
  };

  const db = existsSync(datPath) ? loadDatFile(datPath) : null;
  const promptProjectsDir = resolvePromptProjectsDir(packageRoot);
  openBenchmarkRunsDb(packageRoot);

  async function applyProjectGenerationForSession(
    s: DashboardSession,
    rec: PromptProjectRecord,
  ): Promise<string | null> {
    if (!pool || !textLlmConfigured) return "No text LLM";
    await pool.ensureSessionAttached(s);
    const client = pool.getClientForSession(s);
    const pid = client.providerId;
    const raw =
      pid === "mlx"
        ? rec.generationParams.mlx
        : pid === "http"
          ? rec.generationParams.http
          : rec.generationParams.google;
    if (!raw || typeof raw !== "object") return null;
    return applyGenerationParamsPatch(client, {
      ...raw,
    } as Record<string, unknown>);
  }

  function createDashboardSession(sessionId: string): DashboardSession {
    const clients = new Set<http.ServerResponse>();
    const broadcastSession = (event: string, payload: unknown): void => {
      for (const r of clients) {
        try {
          sseWrite(r, event, payload);
        } catch {
          clients.delete(r);
        }
      }
    };
    const engineGetinQueue = new EngineGetinQueue();
    const llmSel = {
      textLlmProviderId: (defaultTextLlmSelection?.providerId ??
        "mlx") as TextLlmProviderId,
      textLlmModelId: defaultTextLlmSelection?.modelId ?? "",
      poolAttachedKey: null as string | null,
    };

    const textLlmSource = {
      current: createQueuedTextLlm(
        async () => {
          if (!pool || !textLlmConfigured) {
            throw new Error("No text LLM configured");
          }
          const s = sessions.get(sessionId);
          if (!s) throw new Error("Session not found");
          await pool.ensureSessionAttached(s);
          return pool.getClient(poolKey(s.textLlmProviderId, s.textLlmModelId));
        },
        sessionId,
        llmExecutor,
        {
          providerId: () => llmSel.textLlmProviderId,
          modelId: () => llmSel.textLlmModelId,
        },
      ),
    };
    let autoplayRunning: Promise<void> | null = null;
    let autoplayStartScheduled = false;
    let plannerAutoplayEnabled = true;
    let webAutoplayOverrides: AutoplayRunOverrides = {};
    let webPromptExperiment: PromptExperimentPatch =
      defaultPromptExperimentPatch();
    let activePromptProjectId: string | null = null;
    let activeStrategyId = "default";
    let promptProjectEnvBackup: EnvBackup = new Map();
    const benchmarkMeta = {
      teamName: null as string | null,
      tags: [] as readonly string[],
    };

    type BenchAcc = {
      runId: string;
      startedAtMs: number;
      plannerMsTotal: number;
      plannerCalls: number;
      lastCells: number;
      lastMoves: number;
      maxMovesAtStart: number;
      paceMsAtStart: number;
      contextCharsAtStart: number;
    };
    let benchAcc: BenchAcc | null = null;

    const flushBenchmarkRun = (
      status: "completed" | "failed" | "aborted",
      failureReason: string | null,
    ): void => {
      if (benchAcc === null) return;
      const b = benchAcc;
      benchAcc = null;
      const wallTimeMs = Math.max(0, Date.now() - b.startedAtMs);
      const hitMaxMoves = b.lastMoves >= b.maxMovesAtStart;
      const metrics: BenchmarkRunMetricsJson = {
        moves: b.lastMoves,
        cellsDiscovered: b.lastCells,
        wallTimeMs,
        plannerMsTotal: b.plannerMsTotal,
        plannerCalls: b.plannerCalls,
        hitMaxMoves,
      };
      const eventId =
        process.env.ADVENTURE_LLM_BENCHMARK_EVENT_ID?.trim() || null;
      const config: BenchmarkRunConfigJson = {
        maxMoves: b.maxMovesAtStart,
        paceMs: b.paceMsAtStart,
        contextChars: b.contextCharsAtStart,
        providerId: llmSel.textLlmProviderId,
        modelId: llmSel.textLlmModelId,
        projectId: activePromptProjectId,
        strategyId: activeStrategyId === "default" ? null : activeStrategyId,
        eventId,
        teamName: benchmarkMeta.teamName,
        tags: benchmarkMeta.tags,
      };
      let llmSessionJsonlPath: string | null = null;
      const dbg = process.env.ADVENTURE_LLM_DEBUG?.trim();
      if (dbg === "1" || dbg?.toLowerCase() === "true") {
        llmSessionJsonlPath = path.join(
          packageRoot,
          ".cache",
          "llm-sessions",
          `${sessionId}.jsonl`,
        );
      }
      insertBenchmarkRunRow({
        id: b.runId,
        createdAtIso: new Date().toISOString(),
        eventId,
        dashboardSessionId: sessionId,
        teamName: benchmarkMeta.teamName,
        projectId: activePromptProjectId,
        strategyId: activeStrategyId === "default" ? null : activeStrategyId,
        git: readGitWorktreeMeta(repoRoot),
        host: collectHostRuntimeInfo(),
        config,
        metrics,
        status,
        failureReason,
        llmSessionJsonlPath,
      });
    };

    const webAutoplayLiveOverrides: AutoplayRunOverrides = {
      getPaceMs: () =>
        webAutoplayOverrides.paceMs !== undefined
          ? webAutoplayOverrides.paceMs
          : resolveAutoplayPaceMs(),
      getMaxMoves: () =>
        webAutoplayOverrides.maxMoves !== undefined
          ? webAutoplayOverrides.maxMoves
          : resolveAutoplayMaxMoves(),
      getPlannerPromptExperiment: () => webPromptExperiment,
      getAutoplayPromptMode: () => {
        const hooks = resolveAutoplayStrategyHooks(activeStrategyId);
        return hooks.promptMode ?? resolveAutoplayPromptMode();
      },
    };
    let latestTranscript = "";
    let engineLogLineBuffer = "";
    let manualPending: ManualPending | null = null;

    const flushEngineLogBuffer = (step: number): void => {
      if (engineLogLineBuffer.length === 0) return;
      broadcastSession("log_line", {
        line: engineLogLineBuffer,
        step,
        channel: "engine",
      });
      engineLogLineBuffer = "";
    };

    const manualPlannerGate: AutoplayManualPlannerGate = {
      isPlannerEnabled: () => plannerAutoplayEnabled,
      waitForManualLine: () =>
        new Promise((resolve) => {
          const intervalId = setInterval(() => {
            if (plannerAutoplayEnabled) {
              clearInterval(intervalId);
              manualPending = null;
              broadcastSession("manual_waiting", {
                waitingForManual: false,
              });
              resolve(AUTOPLAY_RESUME_PLANNER);
            }
          }, 200);
          manualPending = {
            resolve: (v) => {
              clearInterval(intervalId);
              manualPending = null;
              broadcastSession("manual_waiting", {
                waitingForManual: false,
              });
              resolve(v);
            },
            intervalId,
          };
          broadcastSession("manual_waiting", { waitingForManual: true });
        }),
    };

    const sink: AutoplayUiSink = {
      forwardGameOutputToTerminal: false,
      onSessionStart: (e) => {
        engineLogLineBuffer = "";
        benchAcc = {
          runId: randomUUID(),
          startedAtMs: Date.now(),
          plannerMsTotal: 0,
          plannerCalls: 0,
          lastCells: 0,
          lastMoves: 0,
          maxMovesAtStart: e.maxMoves,
          paceMsAtStart: e.paceMs,
          contextCharsAtStart: e.contextChars,
        };
        const hostRuntime = collectHostRuntimeInfo();
        const git = readGitWorktreeMeta(repoRoot);
        broadcastSession("session_start", {
          ...e,
          modelId: llmSel.textLlmModelId,
          hostRuntime,
          git,
        });
      },
      onSessionEnd: () => {
        flushEngineLogBuffer(0);
        flushBenchmarkRun("completed", null);
        broadcastSession("session_end", {});
      },
      beforePlannerCall: awaitMlxModelReady,
      onPlannerPhase: (e) => {
        if (e.phase === "end" && typeof e.elapsedMs === "number") {
          if (benchAcc !== null) {
            benchAcc.plannerMsTotal += e.elapsedMs;
            benchAcc.plannerCalls += 1;
          }
        }
        broadcastSession("planner_phase", e);
      },
      onPlannerPrompt: (e) => broadcastSession("planner_prompt", e),
      onTranscriptChunk: (text, step) => {
        latestTranscript += text;
        broadcastSession("transcript_delta", { text, step });
        engineLogLineBuffer += text;
        let nl: number;
        while ((nl = engineLogLineBuffer.indexOf("\n")) >= 0) {
          const line = engineLogLineBuffer.slice(0, nl + 1);
          engineLogLineBuffer = engineLogLineBuffer.slice(nl + 1);
          broadcastSession("log_line", { line, step, channel: "engine" });
        }
      },
      onAwaitingPlayerInput: (e) => {
        broadcastSession("getin_prompt_ready", e);
      },
      onTurnEnd: (e) => {
        latestTranscript = e.transcriptSoFar;
        if (benchAcc !== null) {
          benchAcc.lastMoves = e.moveIndex;
          benchAcc.lastCells = e.snapshot.map.cells.length;
        }
        broadcastSession("turn_end", e);
      },
      onPlanApplied: (e) => broadcastSession("plan_applied", e),
      onLogLine: (line, step) =>
        broadcastSession("log_line", { line, step, channel: "planner" }),
    };

    return {
      id: sessionId,
      clients,
      broadcast: broadcastSession,
      engineGetinQueue,
      get autoplayRunning() {
        return autoplayRunning;
      },
      set autoplayRunning(v) {
        autoplayRunning = v;
      },
      get autoplayStartScheduled() {
        return autoplayStartScheduled;
      },
      set autoplayStartScheduled(v) {
        autoplayStartScheduled = v;
      },
      get plannerAutoplayEnabled() {
        return plannerAutoplayEnabled;
      },
      set plannerAutoplayEnabled(v) {
        plannerAutoplayEnabled = v;
      },
      get webAutoplayOverrides() {
        return webAutoplayOverrides;
      },
      set webAutoplayOverrides(v) {
        webAutoplayOverrides = v;
      },
      get webPromptExperiment() {
        return webPromptExperiment;
      },
      set webPromptExperiment(v) {
        webPromptExperiment = v;
      },
      get activePromptProjectId() {
        return activePromptProjectId;
      },
      set activePromptProjectId(v) {
        activePromptProjectId = v;
      },
      get activeStrategyId() {
        return activeStrategyId;
      },
      set activeStrategyId(v) {
        activeStrategyId = v.trim() || "default";
      },
      get promptProjectEnvBackup() {
        return promptProjectEnvBackup;
      },
      set promptProjectEnvBackup(v) {
        promptProjectEnvBackup = v;
      },
      flushBenchmarkRun,
      benchmarkMeta,
      webAutoplayLiveOverrides,
      get latestTranscript() {
        return latestTranscript;
      },
      set latestTranscript(v) {
        latestTranscript = v;
      },
      get engineLogLineBuffer() {
        return engineLogLineBuffer;
      },
      set engineLogLineBuffer(v) {
        engineLogLineBuffer = v;
      },
      get manualPending() {
        return manualPending;
      },
      set manualPending(v) {
        manualPending = v;
      },
      manualPlannerGate,
      sink,
      textLlmSource,
      get textLlmProviderId(): TextLlmProviderId {
        return llmSel.textLlmProviderId;
      },
      set textLlmProviderId(v: TextLlmProviderId) {
        llmSel.textLlmProviderId = v;
      },
      get textLlmModelId(): string {
        return llmSel.textLlmModelId;
      },
      set textLlmModelId(v: string) {
        llmSel.textLlmModelId = v;
      },
      get poolAttachedKey(): string | null {
        return llmSel.poolAttachedKey;
      },
      set poolAttachedKey(v: string | null) {
        llmSel.poolAttachedKey = v;
      },
    };
  }

  function resolveDashboardSession(req: http.IncomingMessage): {
    session: DashboardSession;
    isNew: boolean;
  } {
    const c = parseAdventureSessionCookie(req.headers.cookie);
    if (c !== null && isValidSessionId(c) && sessions.has(c)) {
      return { session: sessions.get(c)!, isNew: false };
    }
    const id = randomUUID();
    const session = createDashboardSession(id);
    sessions.set(id, session);
    return { session, isNew: true };
  }

  const cookieOpts = (sess: DashboardSession, isNew: boolean) => ({
    isNew,
    sessionId: sess.id,
    secureCookies: options.secureCookies,
  });

  const requestListener: http.RequestListener = async (req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const pathname = url.pathname === "" ? "/" : url.pathname;

    let sess: DashboardSession | undefined;
    let newSession = false;
    if (pathname.startsWith("/api/") || pathname === "/events") {
      const r = resolveDashboardSession(req);
      sess = r.session;
      newSession = r.isNew;
    }

    if (pathname === "/api/session" && req.method === "GET") {
      if (sess === undefined) {
        const r = resolveDashboardSession(req);
        sess = r.session;
        newSession = r.isNew;
      }
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          ok: true,
          browserOrchestratedAutoplay:
            resolveBrowserOrchestratedAutoplayFromEnv(),
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/adventure-database" && req.method === "GET") {
      if (sess === undefined) return;
      if (!db) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "adventure.dat not available" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      jsonResponseWithSessionCookie(
        res,
        200,
        { database: serializeAdventureDatabaseToJson(db) },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/autoplay-plan" && req.method === "POST") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured || !db) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "Text model or adventure.dat not available" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        await awaitMlxModelReady();
        await pool.ensureSessionAttached(sess);
        const body = (await readJsonBody(req)) as {
          plannerUserPrompt?: unknown;
          recentGameTextForRepair?: unknown;
          includeDatHelpInSystem?: unknown;
        } | null;
        if (
          body === null ||
          body.plannerUserPrompt === undefined ||
          body.plannerUserPrompt === null
        ) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected plannerUserPrompt" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        const plannerUserPrompt =
          body.plannerUserPrompt as PlannerUserPromptInput;
        const recent =
          typeof body.recentGameTextForRepair === "string"
            ? body.recentGameTextForRepair
            : "";
        const includeDatHelp =
          body.includeDatHelpInSystem === false ? false : true;
        const client = pool.getClientForSession(sess);
        const plan = await llmExecutor.run(sess.id, async () => {
          return planAutoplayWithTextLlm(db, client, {
            plannerUserPrompt,
            recentGameTextForRepair: recent,
            includeDatHelpInSystem: includeDatHelp,
          });
        });
        jsonResponseWithSessionCookie(
          res,
          200,
          { plan },
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        jsonResponseWithSessionCookie(
          res,
          500,
          {
            error: e instanceof Error ? e.message : "Planner request failed",
          },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/autoplay-engine-input" && req.method === "POST") {
      if (sess === undefined) return;
      if (!resolveBrowserOrchestratedAutoplayFromEnv()) {
        jsonResponseWithSessionCookie(
          res,
          404,
          { error: "Browser-orchestrated autoplay is not enabled" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        const body = (await readJsonBody(req)) as {
          endSession?: unknown;
          getinLine?: unknown;
          plan?: unknown;
          motionGridHint?: unknown;
          moveNumber?: unknown;
        } | null;
        if (body === null) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected JSON body" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (body.endSession === true) {
          sess.engineGetinQueue.enqueue(null);
          jsonResponseWithSessionCookie(
            res,
            200,
            { ok: true, action: "endSession" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (
          typeof body.getinLine !== "string" ||
          body.getinLine.trim() === ""
        ) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: 'Expected getinLine: "EAST ..." or endSession: true' },
            cookieOpts(sess, newSession),
          );
          return;
        }
        const line = body.getinLine.trimEnd();
        if (body.plan !== undefined && body.plan !== null) {
          const plan = AutoplayPlannerResponseSchema.parse(body.plan);
          const motionGridHint =
            body.motionGridHint === null || body.motionGridHint === undefined
              ? null
              : String(body.motionGridHint);
          const moveNumber =
            typeof body.moveNumber === "number" &&
            Number.isFinite(body.moveNumber)
              ? Math.max(1, Math.floor(body.moveNumber))
              : 1;
          sess.broadcast("plan_applied", {
            plan,
            scripted: line,
            getinLine: line,
            moveNumber,
            motionGridHint,
          });
        }
        sess.engineGetinQueue.enqueue(line);
        jsonResponseWithSessionCookie(
          res,
          200,
          { ok: true, action: "getinLine" },
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        jsonResponseWithSessionCookie(
          res,
          400,
          {
            error: e instanceof Error ? e.message : "Invalid body",
          },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/autoplay-mode" && req.method === "GET") {
      if (sess === undefined) return;
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          plannerEnabled: sess.plannerAutoplayEnabled,
          waitingForManual: sess.manualPending !== null,
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/autoplay-mode" && req.method === "POST") {
      if (sess === undefined) return;
      try {
        const body = (await readJsonBody(req)) as {
          plannerEnabled?: boolean;
        } | null;
        if (body === null || typeof body.plannerEnabled !== "boolean") {
          jsonResponseWithSessionCookie(
            res,
            400,
            {
              error: "Expected { plannerEnabled: boolean }",
            },
            cookieOpts(sess, newSession),
          );
          return;
        }
        sess.plannerAutoplayEnabled = body.plannerEnabled;
        sess.broadcast("autoplay_mode", {
          plannerEnabled: sess.plannerAutoplayEnabled,
        });
        jsonResponseWithSessionCookie(
          res,
          200,
          { plannerEnabled: sess.plannerAutoplayEnabled },
          cookieOpts(sess, newSession),
        );
      } catch {
        jsonResponseWithSessionCookie(
          res,
          400,
          { error: "Invalid JSON" },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/autoplay-settings" && req.method === "GET") {
      if (sess === undefined) return;
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          paceMs:
            sess.webAutoplayOverrides.paceMs !== undefined
              ? sess.webAutoplayOverrides.paceMs
              : resolveAutoplayPaceMs(),
          maxMoves:
            sess.webAutoplayOverrides.maxMoves !== undefined
              ? sess.webAutoplayOverrides.maxMoves
              : resolveAutoplayMaxMoves(),
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/prompt-experiment" && req.method === "GET") {
      if (sess === undefined) return;
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          patch: sess.webPromptExperiment,
          activeProjectId: sess.activePromptProjectId,
          note: "Applies to autoplay planner only, not manual interpret.",
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/prompt-experiment" && req.method === "PATCH") {
      if (sess === undefined) return;
      try {
        const body = (await readJsonBody(req)) as Record<
          string,
          unknown
        > | null;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected JSON object" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        sess.webPromptExperiment = patchPromptExperimentPatch(
          sess.webPromptExperiment,
          body,
        );
        sess.broadcast("prompt_experiment", {
          patch: sess.webPromptExperiment,
        });
        jsonResponseWithSessionCookie(
          res,
          200,
          { patch: sess.webPromptExperiment },
          cookieOpts(sess, newSession),
        );
      } catch {
        jsonResponseWithSessionCookie(
          res,
          400,
          { error: "Invalid JSON" },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/llm-generation-params" && req.method === "GET") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "No text LLM configured" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        await pool.ensureSessionAttached(sess);
        jsonResponseWithSessionCookie(
          res,
          200,
          snapshotGenerationMeta(pool.getClientForSession(sess)),
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        jsonResponseWithSessionCookie(
          res,
          500,
          {
            error:
              e instanceof Error ? e.message : "Failed to attach text model",
          },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/llm-generation-params" && req.method === "PATCH") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "No text LLM configured" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        const body = (await readJsonBody(req)) as Record<
          string,
          unknown
        > | null;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected JSON object" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        await pool.ensureSessionAttached(sess);
        const client = pool.getClientForSession(sess);
        const err = applyGenerationParamsPatch(client, body);
        if (err) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: err },
            cookieOpts(sess, newSession),
          );
          return;
        }
        jsonResponseWithSessionCookie(
          res,
          200,
          snapshotGenerationMeta(client),
          cookieOpts(sess, newSession),
        );
      } catch {
        jsonResponseWithSessionCookie(
          res,
          400,
          { error: "Invalid JSON" },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    const promptProjectActivateMatch =
      /^\/api\/prompt-projects\/([^/]+)\/activate$/.exec(pathname);
    if (promptProjectActivateMatch && req.method === "POST") {
      if (sess === undefined) return;
      const idAct = promptProjectActivateMatch[1]!;
      const s = sess;
      const ns = newSession;
      readPromptProject(promptProjectsDir, idAct).then(async (rec) => {
        if (!rec) {
          jsonResponseWithSessionCookie(
            res,
            404,
            { error: "Project not found" },
            cookieOpts(s, ns),
          );
          return;
        }
        restoreEnvFromBackup(s.promptProjectEnvBackup);
        s.promptProjectEnvBackup = new Map();
        s.activeStrategyId = rec.strategy?.id?.trim() || "default";
        const hooks = resolveAutoplayStrategyHooks(s.activeStrategyId);
        const mergedAllow = mergeEnvAllowlists(
          hooks.defaultEnvAllowlist ?? {},
          sanitizePromptProjectEnvAllowlist(
            rec.envAllowlist as Record<string, string> | undefined,
          ),
        );
        s.promptProjectEnvBackup = applyAllowlistedEnvToProcess(mergedAllow);
        s.webPromptExperiment = {
          ...defaultPromptExperimentPatch(),
          ...rec.promptExperiment,
        };
        s.activePromptProjectId = idAct;
        s.benchmarkMeta.teamName = rec.teamName ?? null;
        s.benchmarkMeta.tags = rec.tags ?? [];
        if (rec.maxMoves !== undefined) {
          s.webAutoplayOverrides = {
            ...s.webAutoplayOverrides,
            maxMoves: rec.maxMoves,
          };
          const paceMs =
            s.webAutoplayOverrides.paceMs !== undefined
              ? s.webAutoplayOverrides.paceMs
              : resolveAutoplayPaceMs();
          s.broadcast("autoplay_settings", {
            paceMs,
            maxMoves: rec.maxMoves,
          });
        }
        const gerr = await applyProjectGenerationForSession(s, rec);
        s.broadcast("prompt_project", { activeId: idAct, name: rec.name });
        if (gerr && gerr !== "No text LLM") {
          jsonResponseWithSessionCookie(
            res,
            200,
            {
              ok: true,
              project: rec,
              generationWarning: gerr,
            },
            cookieOpts(s, ns),
          );
          return;
        }
        jsonResponseWithSessionCookie(
          res,
          200,
          { ok: true, project: rec },
          cookieOpts(s, ns),
        );
      });
      return;
    }

    const promptProjectDuplicateMatch =
      /^\/api\/prompt-projects\/([^/]+)\/duplicate$/.exec(pathname);
    if (promptProjectDuplicateMatch && req.method === "POST") {
      if (sess === undefined) return;
      const idSrc = promptProjectDuplicateMatch[1]!;
      const s = sess;
      const ns = newSession;
      readJsonBody(req).then(async (rawBody) => {
        const body = rawBody as { name?: string } | null;
        const name =
          typeof body?.name === "string"
            ? body.name.trim().slice(0, 120) || "Untitled (copy)"
            : "Untitled (copy)";
        const src = await readPromptProject(promptProjectsDir, idSrc);
        if (!src) {
          jsonResponseWithSessionCookie(
            res,
            404,
            { error: "Project not found" },
            cookieOpts(s, ns),
          );
          return;
        }
        const now = new Date().toISOString();
        const idNew = newPromptProjectId();
        const dup: PromptProjectRecord = upgradePromptProjectToLatest({
          ...src,
          id: idNew,
          name,
          parentProjectId: src.id,
          createdAt: now,
          updatedAt: now,
        });
        try {
          await writePromptProject(promptProjectsDir, dup);
          jsonResponseWithSessionCookie(res, 201, dup, cookieOpts(s, ns));
        } catch (e) {
          jsonResponseWithSessionCookie(
            res,
            500,
            { error: e instanceof Error ? e.message : "Write failed" },
            cookieOpts(s, ns),
          );
        }
      });
      return;
    }

    const promptProjectOneMatch = /^\/api\/prompt-projects\/([^/]+)$/.exec(
      pathname,
    );
    if (pathname === "/api/prompt-projects" && req.method === "GET") {
      if (sess === undefined) return;
      const s = sess;
      const ns = newSession;
      listPromptProjects(promptProjectsDir).then((list) => {
        jsonResponseWithSessionCookie(
          res,
          200,
          {
            projects: list,
            activeId: s.activePromptProjectId,
          },
          cookieOpts(s, ns),
        );
      });
      return;
    }

    if (pathname === "/api/prompt-projects" && req.method === "POST") {
      if (sess === undefined) return;
      const s = sess;
      const ns = newSession;
      readJsonBody(req).then(async (rawBody) => {
        try {
          const body = rawBody as Record<string, unknown> | null;
          const name =
            body !== null &&
            typeof body === "object" &&
            typeof body.name === "string"
              ? body.name.trim().slice(0, 120) || "Untitled"
              : "Untitled";
          const description =
            body !== null &&
            typeof body === "object" &&
            typeof body.description === "string"
              ? body.description.trim().slice(0, 2000)
              : undefined;
          const now = new Date().toISOString();
          const idNew = newPromptProjectId();
          let genSnap = buildGenerationParamsSnapshot(null);
          if (
            pool &&
            textLlmConfigured &&
            s.poolAttachedKey === poolKey(s.textLlmProviderId, s.textLlmModelId)
          ) {
            genSnap = buildGenerationParamsSnapshot(
              pool.getClientForSession(s),
            );
          }
          const maxMoves =
            s.webAutoplayOverrides.maxMoves !== undefined
              ? s.webAutoplayOverrides.maxMoves
              : resolveAutoplayMaxMoves();
          const rec: PromptProjectRecord = {
            schemaVersion: PROMPT_PROJECT_SCHEMA_LATEST,
            id: idNew,
            name,
            ...(description ? { description } : {}),
            createdAt: now,
            updatedAt: now,
            promptExperiment: { ...s.webPromptExperiment },
            generationParams: genSnap,
            subsystemToggles: {
              inventory: false,
              graph: false,
              xyz: false,
              reactionLedger: false,
            },
            maxMoves,
            ...(s.activeStrategyId !== "default" && s.activeStrategyId !== ""
              ? { strategy: { id: s.activeStrategyId } }
              : {}),
          };
          writePromptProject(promptProjectsDir, rec)
            .then(() => {
              jsonResponseWithSessionCookie(res, 201, rec, cookieOpts(s, ns));
            })
            .catch((e) => {
              jsonResponseWithSessionCookie(
                res,
                500,
                {
                  error: e instanceof Error ? e.message : "Write failed",
                },
                cookieOpts(s, ns),
              );
            });
        } catch (e) {
          jsonResponseWithSessionCookie(
            res,
            400,
            {
              error: e instanceof Error ? e.message : "Invalid",
            },
            cookieOpts(s, ns),
          );
        }
      });
      return;
    }

    if (promptProjectOneMatch && req.method === "GET") {
      if (sess === undefined) return;
      const idG = promptProjectOneMatch[1]!;
      const s = sess;
      const ns = newSession;
      readPromptProject(promptProjectsDir, idG).then((rec) => {
        if (!rec) {
          jsonResponseWithSessionCookie(
            res,
            404,
            { error: "Not found" },
            cookieOpts(s, ns),
          );
          return;
        }
        jsonResponseWithSessionCookie(res, 200, rec, cookieOpts(s, ns));
      });
      return;
    }

    if (promptProjectOneMatch && req.method === "PUT") {
      if (sess === undefined) return;
      const idU = promptProjectOneMatch[1]!;
      const s = sess;
      const ns = newSession;
      readJsonBody(req).then((rawBody) => {
        try {
          const body = rawBody as PromptProjectRecord | null;
          if (
            body === null ||
            (body.schemaVersion !== 1 && body.schemaVersion !== 2) ||
            body.id !== idU
          ) {
            jsonResponseWithSessionCookie(
              res,
              400,
              {
                error:
                  "Expected full project JSON with schemaVersion 1 or 2 and matching id",
              },
              cookieOpts(s, ns),
            );
            return;
          }
          const updated: PromptProjectRecord = upgradePromptProjectToLatest({
            ...body,
            updatedAt: new Date().toISOString(),
          });
          writePromptProject(promptProjectsDir, updated)
            .then(() =>
              jsonResponseWithSessionCookie(
                res,
                200,
                updated,
                cookieOpts(s, ns),
              ),
            )
            .catch((e) => {
              jsonResponseWithSessionCookie(
                res,
                500,
                {
                  error: e instanceof Error ? e.message : "Write failed",
                },
                cookieOpts(s, ns),
              );
            });
        } catch (e) {
          jsonResponseWithSessionCookie(
            res,
            400,
            {
              error: e instanceof Error ? e.message : "Invalid",
            },
            cookieOpts(s, ns),
          );
        }
      });
      return;
    }

    if (promptProjectOneMatch && req.method === "DELETE") {
      if (sess === undefined) return;
      const idD = promptProjectOneMatch[1]!;
      const s = sess;
      const ns = newSession;
      deletePromptProject(promptProjectsDir, idD).then((ok) => {
        if (!ok) {
          jsonResponseWithSessionCookie(
            res,
            404,
            { error: "Not found" },
            cookieOpts(s, ns),
          );
          return;
        }
        if (s.activePromptProjectId === idD) s.activePromptProjectId = null;
        jsonResponseWithSessionCookie(
          res,
          200,
          { ok: true },
          cookieOpts(s, ns),
        );
      });
      return;
    }

    if (pathname === "/api/autoplay-strategies" && req.method === "GET") {
      if (sess === undefined) return;
      jsonResponseWithSessionCookie(
        res,
        200,
        { strategies: [...listAutoplayStrategyIds()] },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (
      pathname === "/api/benchmark-runs/leaderboard" &&
      req.method === "GET"
    ) {
      if (sess === undefined) return;
      const bdb = openBenchmarkRunsDb(packageRoot);
      if (bdb === null) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "Benchmark runs disabled (ADVENTURE_LLM_BENCHMARK_RUNS=0)" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      const sp = url.searchParams;
      const eventId = sp.get("eventId") ?? undefined;
      const includeFailed = sp.get("includeFailed") === "1";
      const sortRaw = sp.get("sort") ?? "cellsDiscovered";
      const sort =
        sortRaw === "moves" ||
        sortRaw === "wallTimeMs" ||
        sortRaw === "plannerMsTotal"
          ? sortRaw
          : "cellsDiscovered";
      const limitRaw = Number(sp.get("limit") ?? "50");
      const limit =
        Number.isFinite(limitRaw) && limitRaw >= 1 && limitRaw <= 500
          ? Math.floor(limitRaw)
          : 50;
      const rows = queryBenchmarkLeaderboard(bdb, {
        eventId,
        includeFailed,
        sort,
        limit,
      });
      jsonResponseWithSessionCookie(
        res,
        200,
        { runs: rows },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/parser-verbs" && req.method === "GET") {
      if (sess === undefined) return;
      if (!db) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "adventure.dat not available" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      const groups = buildVerbSynonymGroups(db);
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          groups: groups.map((g) => g.tokens),
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/autoplay-settings" && req.method === "POST") {
      if (sess === undefined) return;
      try {
        const body = (await readJsonBody(req)) as {
          paceMs?: unknown;
          maxMoves?: unknown;
        } | null;
        if (body === null || typeof body !== "object") {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected JSON object" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (body.paceMs !== undefined) {
          const n = Number(body.paceMs);
          if (!Number.isFinite(n) || n < 0 || n > 3_600_000) {
            jsonResponseWithSessionCookie(
              res,
              400,
              { error: "paceMs must be 0..3600000" },
              cookieOpts(sess, newSession),
            );
            return;
          }
          sess.webAutoplayOverrides = {
            ...sess.webAutoplayOverrides,
            paceMs: Math.floor(n),
          };
        }
        if (body.maxMoves !== undefined) {
          const n = Number(body.maxMoves);
          if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
            jsonResponseWithSessionCookie(
              res,
              400,
              { error: "maxMoves must be 1..1000000" },
              cookieOpts(sess, newSession),
            );
            return;
          }
          sess.webAutoplayOverrides = {
            ...sess.webAutoplayOverrides,
            maxMoves: Math.floor(n),
          };
        }
        const outPace =
          sess.webAutoplayOverrides.paceMs !== undefined
            ? sess.webAutoplayOverrides.paceMs
            : resolveAutoplayPaceMs();
        const outMax =
          sess.webAutoplayOverrides.maxMoves !== undefined
            ? sess.webAutoplayOverrides.maxMoves
            : resolveAutoplayMaxMoves();
        sess.broadcast("autoplay_settings", {
          paceMs: outPace,
          maxMoves: outMax,
        });
        jsonResponseWithSessionCookie(
          res,
          200,
          { paceMs: outPace, maxMoves: outMax },
          cookieOpts(sess, newSession),
        );
      } catch {
        jsonResponseWithSessionCookie(
          res,
          400,
          { error: "Invalid JSON" },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/text-llm" && req.method === "GET") {
      if (sess === undefined) return;
      const backends = buildTextLlmBackendSnapshots();
      const packaging = buildLlmPackagingDiscoveryPayload();
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          200,
          {
            current: null,
            backends,
            canSwap: false,
            packaging,
          },
          cookieOpts(sess, newSession),
        );
        return;
      }
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          current: {
            providerId: sess.textLlmProviderId,
            modelId: sess.textLlmModelId,
          },
          backends,
          canSwap: canSwapTextLlmFromBackends(backends),
          packaging,
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/mlx-model" && req.method === "GET") {
      if (sess === undefined) return;
      const backends = buildTextLlmBackendSnapshots();
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          200,
          {
            canSwap: false,
            modelId: "",
            presets: [...mlxWebModelPresetsList()],
          },
          cookieOpts(sess, newSession),
        );
        return;
      }
      const canSwap =
        sess.textLlmProviderId === "mlx" &&
        canSwapTextLlmFromBackends(backends);
      jsonResponseWithSessionCookie(
        res,
        200,
        {
          canSwap,
          modelId: sess.textLlmModelId,
          presets: [...mlxWebModelPresetsList()],
        },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/mlx-model/cancel" && req.method === "POST") {
      if (sess === undefined) return;
      if (mlxUiRefs.swapInFlight === null) {
        jsonResponseWithSessionCookie(
          res,
          400,
          {
            error: "No cancellable model load in progress (swap only)",
          },
          cookieOpts(sess, newSession),
        );
        return;
      }
      mlxUiRefs.loadCancelled = true;
      const toDispose = mlxUiRefs.swapInFlight;
      mlxUiRefs.swapInFlight = null;
      try {
        await toDispose.dispose();
      } catch {
        /* dispose may throw if already torn down */
      }
      jsonResponseWithSessionCookie(
        res,
        200,
        { ok: true, cancelled: true },
        cookieOpts(sess, newSession),
      );
      return;
    }

    if (pathname === "/api/text-llm" && req.method === "POST") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "No text model configured" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        const body = (await readJsonBody(req)) as {
          providerId?: string;
          modelId?: string;
        } | null;
        const rawPid =
          body !== null && typeof body.providerId === "string"
            ? body.providerId
            : "";
        const rawMid =
          body !== null && typeof body.modelId === "string" ? body.modelId : "";
        const pid = rawPid.trim().toLowerCase() as TextLlmProviderId;
        const mid = rawMid.trim();
        if (
          mid === "" ||
          (pid !== "mlx" && pid !== "http" && pid !== "google")
        ) {
          jsonResponseWithSessionCookie(
            res,
            400,
            {
              error:
                'Expected { providerId: "mlx"|"http"|"google", modelId: string }',
            },
            cookieOpts(sess, newSession),
          );
          return;
        }
        await pool.switchSessionModel(sess, pid, mid);
        broadcastSessionTextLlm(sess);
        jsonResponseWithSessionCookie(
          res,
          200,
          {
            providerId: sess.textLlmProviderId,
            modelId: sess.textLlmModelId,
          },
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Model swap failed";
        const clientErr =
          /not configured|Unknown or disallowed|Expected \{|At most \d+ loaded text model\(s\) allowed/.test(
            msg,
          );
        jsonResponseWithSessionCookie(
          res,
          clientErr ? 400 : 500,
          { error: msg },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/mlx-model" && req.method === "POST") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          503,
          { error: "No text model configured" },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        const body = (await readJsonBody(req)) as { modelId?: string } | null;
        const raw =
          body !== null && typeof body.modelId === "string" ? body.modelId : "";
        const nextId = raw.trim();
        if (nextId === "" || !isAllowedMlxWebModelId(nextId)) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Unknown or disallowed modelId" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        await pool.switchSessionModel(sess, "mlx", nextId);
        broadcastSessionTextLlm(sess);
        jsonResponseWithSessionCookie(
          res,
          200,
          { modelId: sess.textLlmModelId },
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Model swap failed";
        const clientErr =
          /not configured|Unknown or disallowed|At most \d+ loaded text model\(s\) allowed/.test(
            msg,
          );
        jsonResponseWithSessionCookie(
          res,
          clientErr ? 400 : 500,
          { error: msg },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/api/manual-command" && req.method === "POST") {
      if (sess === undefined) return;
      if (!pool || !textLlmConfigured || !db) {
        jsonResponseWithSessionCookie(
          res,
          503,
          {
            error: "Text model or adventure.dat not available",
          },
          cookieOpts(sess, newSession),
        );
        return;
      }
      const pend = sess.manualPending;
      if (pend === null) {
        jsonResponseWithSessionCookie(
          res,
          409,
          {
            error:
              "Not waiting for a manual command (enable manual mode and wait for the prompt)",
          },
          cookieOpts(sess, newSession),
        );
        return;
      }
      try {
        await awaitMlxModelReady();
        const body = (await readJsonBody(req)) as {
          endSession?: boolean;
          getinLine?: string;
          natural?: string;
        } | null;
        if (body === null) {
          jsonResponseWithSessionCookie(
            res,
            400,
            { error: "Expected JSON body" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (body.endSession === true) {
          pend.resolve(null);
          jsonResponseWithSessionCookie(
            res,
            200,
            { ok: true, action: "endSession" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (typeof body.natural === "string" && body.natural.trim() !== "") {
          /* Pool attach uses runSerialized → llmExecutor.flush(); never await that inside llmExecutor.run (deadlock). */
          await pool!.ensureSessionAttached(sess);
          const interpreted = await llmExecutor.run(sess.id, async () => {
            return interpretWithTextLlm(
              body.natural!.trim(),
              db,
              pool!.getClientForSession(sess),
              {
                recentGameText: sess.latestTranscript.slice(-8000),
              },
            );
          });
          const firstLine = interpretedToGetinLine(interpreted);
          const swapped = swapInterpretedTokens(interpreted);
          const retryLine = swapped
            ? interpretedToGetinLine(swapped)
            : undefined;
          let scripted: ScriptedGetinLine;
          if (
            retryLine !== undefined &&
            retryLine.trimEnd() !== firstLine.trimEnd()
          ) {
            scripted = { line: firstLine, retryIfRejected: retryLine };
          } else {
            scripted = firstLine;
          }
          pend.resolve(scripted);
          jsonResponseWithSessionCookie(
            res,
            200,
            { ok: true, action: "natural" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        if (
          typeof body.getinLine === "string" &&
          body.getinLine.trim() !== ""
        ) {
          pend.resolve(body.getinLine.trimEnd());
          jsonResponseWithSessionCookie(
            res,
            200,
            { ok: true, action: "getinLine" },
            cookieOpts(sess, newSession),
          );
          return;
        }
        jsonResponseWithSessionCookie(
          res,
          400,
          {
            error:
              'Provide endSession: true, getinLine: "EAST ...", or natural: "go east"',
          },
          cookieOpts(sess, newSession),
        );
      } catch (e) {
        jsonResponseWithSessionCookie(
          res,
          400,
          {
            error: e instanceof Error ? e.message : "Request failed",
          },
          cookieOpts(sess, newSession),
        );
      }
      return;
    }

    if (pathname === "/events" && req.method === "GET") {
      if (sess === undefined) return;
      const evHeaders: Record<string, string | number | string[]> = {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      };
      if (newSession) {
        evHeaders["Set-Cookie"] = formatSessionSetCookie(sess.id, {
          secure: options.secureCookies,
        });
      }
      res.writeHead(200, evHeaders);
      res.write(": connected\n\n");
      sseWrite(res, "autoplay_mode", {
        plannerEnabled: sess.plannerAutoplayEnabled,
      });
      sseWrite(res, "autoplay_settings", {
        paceMs:
          sess.webAutoplayOverrides.paceMs !== undefined
            ? sess.webAutoplayOverrides.paceMs
            : resolveAutoplayPaceMs(),
        maxMoves:
          sess.webAutoplayOverrides.maxMoves !== undefined
            ? sess.webAutoplayOverrides.maxMoves
            : resolveAutoplayMaxMoves(),
      });
      sseWrite(res, "manual_waiting", {
        waitingForManual: sess.manualPending !== null,
      });
      if (db) {
        sseWrite(res, "parser_verbs", {
          groups: buildVerbSynonymGroups(db).map((g) => g.tokens),
        });
      } else {
        sseWrite(res, "parser_verbs", { groups: [], datAvailable: false });
      }
      if (pool && textLlmConfigured) {
        try {
          await pool.ensureSessionAttached(sess);
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Failed to load text model";
          sseWrite(res, "session_error", { message: msg });
          sess.clients.add(res);
          req.on("close", () => {
            sess!.clients.delete(res);
          });
          return;
        }
        sseWrite(res, "text_llm", {
          providerId: sess.textLlmProviderId,
          modelId: sess.textLlmModelId,
        });
        sseWrite(res, "mlx_model", {
          modelId: sess.textLlmModelId,
          providerId: sess.textLlmProviderId,
        });
        if (sess.textLlmProviderId === "mlx" && mlxLoadUiActive) {
          sseWrite(res, "mlx_loading", {
            loading: true,
            message: "Loading MLX model…",
            resetProgress: true,
            canCancel: mlxUiRefs.swapInFlight !== null,
          });
        }
      }
      sess.clients.add(res);
      req.on("close", () => {
        sess!.clients.delete(res);
      });

      if (!pool || !textLlmConfigured) {
        sseWrite(res, "session_error", {
          message:
            "No text model configured (GEMINI_API_KEY, ADVENTURE_LLM_HTTP_MODEL, or MLX). See adventure-llm/.env.example.",
        });
        return;
      }
      if (!existsSync(adventureBin)) {
        sseWrite(res, "session_error", {
          message:
            "Cannot find ./adventure next to adventure.dat. From the repository root run: make",
        });
        return;
      }

      if (!sess.autoplayRunning && !sess.autoplayStartScheduled) {
        sess.autoplayStartScheduled = true;
        const sid = sess.id;
        const sref = sess;
        sess.autoplayRunning = (async () => {
          try {
            await runWithWebDashboardLlmLogContext(sid, async () => {
              await pool!.ensureSessionAttached(sref);
              const sessionClient = pool!.getClientForSession(sref);
              if (sessionClient instanceof MlxLmStdioTextLlm) {
                beginMlxModelLoad();
                try {
                  await ensureMlxWorkerReady(sessionClient);
                } finally {
                  endMlxModelLoad();
                }
              } else {
                await ensureMlxWorkerReady(sessionClient);
              }
              if (resolveBrowserOrchestratedAutoplayFromEnv()) {
                await runBrowserOrchestratedEngineSession(
                  { repoRoot, datPath },
                  sref.sink,
                  {
                    sessionProviderId: sref.textLlmProviderId,
                    waitForEngineGetin: async () =>
                      sref.engineGetinQueue.dequeue(),
                    manualPlannerGate: sref.manualPlannerGate,
                    overrides: sref.webAutoplayLiveOverrides,
                  },
                );
              } else {
                await runAutoplaySessionWithTextLlm(
                  sref.textLlmSource,
                  { repoRoot, datPath },
                  sref.sink,
                  sref.manualPlannerGate,
                  sref.webAutoplayLiveOverrides,
                );
              }
            });
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : `autoplay failed: ${String(err)}`;
            sref.flushBenchmarkRun(
              "failed",
              err instanceof Error
                ? err.message.slice(0, 500)
                : String(err).slice(0, 500),
            );
            sref.broadcast("session_error", { message: msg });
            if (
              shouldFallbackToClassicForLlmError(err, sref.textLlmProviderId)
            ) {
              sref.broadcast("log_line", {
                line: "adventure-llm: text model unavailable (quota, rate limit, network, or service error).\n",
                step: 0,
                channel: "planner",
              });
            }
          } finally {
            sref.autoplayRunning = null;
            sref.autoplayStartScheduled = false;
          }
        })();
      }
      return;
    }

    const staticRelative =
      pathname === "/"
        ? "index.html"
        : pathname === "/favicon.ico"
          ? "favicon.svg"
          : pathname.slice(1);
    const filePath = path.join(publicDir, staticRelative);
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403).end();
      return;
    }

    try {
      const st = await stat(filePath);
      if (!st.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
    } catch {
      res.writeHead(404).end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const base = path.basename(filePath);
    const noCacheDashboardAsset =
      base === "index.html" ||
      base === "app.js" ||
      base === "dashboard.css" ||
      base === "promptLab.js";
    const staticHeaders: Record<string, string | number | string[]> = {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      ...(noCacheDashboardAsset ? { "Cache-Control": "no-store" } : {}),
    };
    if (base === "index.html") {
      const r = resolveDashboardSession(req);
      if (r.isNew) {
        staticHeaders["Set-Cookie"] = formatSessionSetCookie(r.session.id, {
          secure: options.secureCookies,
        });
      }
    }
    res.writeHead(200, staticHeaders);
    createReadStream(filePath).pipe(res);
  };

  if (options.httpsOptions) {
    return https.createServer(options.httpsOptions, requestListener);
  }
  return http.createServer(requestListener);
}

async function main(): Promise<void> {
  const dbg = process.env.ADVENTURE_LLM_DEBUG?.trim();
  const dbgOn = dbg === "1" || dbg?.toLowerCase() === "true";
  if (dbgOn) {
    if (process.env.ADVENTURE_LLM_DEBUG_LOG?.trim()) {
      const logPath = resolveDebugLogPath();
      if (logPath) {
        process.stderr.write(`adventure-llm: interaction log → ${logPath}\n`);
      }
    } else {
      process.stderr.write(
        `adventure-llm: interaction logs → ${path.join(process.cwd(), ".cache", "llm-sessions", "<sessionId>.jsonl")} (web) or ${path.join(process.cwd(), ".cache", "llm-interactions.jsonl")} (CLI)\n`,
      );
    }
  }

  const port = resolveWebPort();
  const insecure = isWebDashboardInsecureHttp();
  const tls = !insecure ? resolveWebDashboardTls(packageRoot) : null;
  if (!insecure && tls === null) {
    process.stderr.write(
      "adventure-llm: No TLS certificate found. Run: npm run web:tls-init\n" +
        "  Or set ADVENTURE_LLM_WEB_TLS_KEY / ADVENTURE_LLM_WEB_TLS_CERT, or use ADVENTURE_LLM_WEB_INSECURE_HTTP=1 (not recommended).\n",
    );
    process.exit(1);
  }
  if (insecure) {
    process.stderr.write(
      "adventure-llm: ADVENTURE_LLM_WEB_INSECURE_HTTP=1 — session cookies are not Secure; use only on trusted networks.\n",
    );
  }
  const secureCookies = !insecure && tls !== null;
  const server = createAutoplayDashboardServer({
    secureCookies,
    httpsOptions: tls ? httpsServerOptionsFromTls(tls) : undefined,
  });
  const proto = tls ? "https" : "http";
  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `adventure-llm: autoplay web dashboard → ${proto}://127.0.0.1:${port}/\n`,
    );
    process.stderr.write(
      "Open the URL in a browser; autoplay starts when the page subscribes to /events.\n",
    );
  });
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryFile && fileURLToPath(import.meta.url) === entryFile) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
