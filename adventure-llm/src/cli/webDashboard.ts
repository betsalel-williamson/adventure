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
import {
  buildTextLlmBackendSnapshots,
  canSwapTextLlmFromBackends,
} from "../nl/textLlmWebBackends.js";
import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";
import {
  runAutoplaySessionWithTextLlm,
  AUTOPLAY_RESUME_PLANNER,
  resolveAutoplayMaxMoves,
  resolveAutoplayPaceMs,
  type AutoplayManualPlannerGate,
  type AutoplayRunOverrides,
  type AutoplayUiSink,
} from "./autoplayRunner.js";
import {
  deletePromptProject,
  listPromptProjects,
  newPromptProjectId,
  readPromptProject,
  resolvePromptProjectsDir,
  writePromptProject,
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
  autoplayRunning: Promise<void> | null;
  autoplayStartScheduled: boolean;
  plannerAutoplayEnabled: boolean;
  webAutoplayOverrides: AutoplayRunOverrides;
  webPromptExperiment: PromptExperimentPatch;
  activePromptProjectId: string | null;
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
    const llmSel = {
      textLlmProviderId: (defaultTextLlmSelection?.providerId ??
        "mlx") as TextLlmProviderId,
      textLlmModelId: defaultTextLlmSelection?.modelId ?? "",
      poolAttachedKey: null as string | null,
    };

    const textLlmSource = {
      current: createQueuedTextLlm(
        () => {
          if (!pool || !textLlmConfigured) {
            throw new Error("No text LLM configured");
          }
          const s = sessions.get(sessionId);
          if (!s) throw new Error("Session not found");
          return pool.getClient(poolKey(s.textLlmProviderId, s.textLlmModelId));
        },
        sessionId,
        llmExecutor,
      ),
    };
    let autoplayRunning: Promise<void> | null = null;
    let autoplayStartScheduled = false;
    let plannerAutoplayEnabled = true;
    let webAutoplayOverrides: AutoplayRunOverrides = {};
    let webPromptExperiment: PromptExperimentPatch =
      defaultPromptExperimentPatch();
    let activePromptProjectId: string | null = null;
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
        broadcastSession("session_start", e);
      },
      onSessionEnd: () => {
        flushEngineLogBuffer(0);
        broadcastSession("session_end", {});
      },
      beforePlannerCall: awaitMlxModelReady,
      onPlannerPhase: (e) => broadcastSession("planner_phase", e),
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
      onTurnEnd: (e) => {
        latestTranscript = e.transcriptSoFar;
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
        { ok: true },
        cookieOpts(sess, newSession),
      );
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
        s.webPromptExperiment = {
          ...defaultPromptExperimentPatch(),
          ...rec.promptExperiment,
        };
        s.activePromptProjectId = idAct;
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
          const rec: PromptProjectRecord = {
            schemaVersion: 1,
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
          if (body === null || body.schemaVersion !== 1 || body.id !== idU) {
            jsonResponseWithSessionCookie(
              res,
              400,
              {
                error: "Expected full project JSON with matching id",
              },
              cookieOpts(s, ns),
            );
            return;
          }
          const updated: PromptProjectRecord = {
            ...body,
            updatedAt: new Date().toISOString(),
          };
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
      if (!pool || !textLlmConfigured) {
        jsonResponseWithSessionCookie(
          res,
          200,
          {
            current: null,
            backends,
            canSwap: false,
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
              await runAutoplaySessionWithTextLlm(
                sref.textLlmSource,
                { repoRoot, datPath },
                sref.sink,
                sref.manualPlannerGate,
                sref.webAutoplayLiveOverrides,
              );
            });
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : `autoplay failed: ${String(err)}`;
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
