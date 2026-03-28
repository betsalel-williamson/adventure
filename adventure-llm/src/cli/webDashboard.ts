#!/usr/bin/env node
/**
 * Local HTTP dashboard for autoplay: static HTML/JS + SSE stream of game text,
 * planner phases, heuristic map/inventory, prompt previews, and optional manual GETIN.
 */
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { loadDatFile } from "../dat/loadDat.js";
import {
  createGoogleTextLlmFromEnv,
  createHttpTextLlmFromEnv,
  createMlxTextLlmFromEnv,
  interpretWithTextLlm,
  mlxLmOptionsFromEnv,
  resolveTextLlmFromEnv,
} from "../nl/adventureTextLlm.js";
import { isAllowedGoogleWebModelId } from "../nl/googleWebModelPresets.js";
import { isAllowedHttpWebModelId } from "../nl/httpWebPresets.js";
import { shouldFallbackToClassicForLlmError } from "../nl/llmErrors.js";
import { resolveDebugLogPath } from "../nl/llmDebug.js";
import {
  isAllowedMlxWebModelId,
  MLX_WEB_MODEL_PRESETS,
} from "../nl/mlxModelPresets.js";
import { MlxLmStdioTextLlm } from "../nl/providers/mlxLmStdioTextLlm.js";
import { interpretedToGetinLine, swapInterpretedTokens } from "../nl/schema.js";
import { buildVerbSynonymGroups } from "../vocab/verbSynonymGroups.js";
import type { TextLlm, TextLlmProviderId } from "../nl/textLlmContract.js";
import {
  buildTextLlmBackendSnapshots,
  canSwapTextLlmFromBackends,
  googleBackendAvailableFromEnv,
  httpBackendAvailableFromEnv,
  mlxBackendAvailableFromEnv,
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

type ManualPending = {
  resolve: (
    v: ScriptedGetinLine | null | typeof AUTOPLAY_RESUME_PLANNER,
  ) => void;
  intervalId: ReturnType<typeof setInterval>;
};

export function createAutoplayDashboardServer(): http.Server {
  const clients = new Set<http.ServerResponse>();
  let autoplayRunning: Promise<void> | null = null;
  let autoplayStartScheduled = false;

  const broadcast = (event: string, payload: unknown): void => {
    for (const res of clients) {
      try {
        sseWrite(res, event, payload);
      } catch {
        clients.delete(res);
      }
    }
  };

  let mlxSwapChain: Promise<void> = Promise.resolve();

  /** Resolved until {@link beginMlxModelLoad}; autoplay and NL interpret await this. */
  let mlxLoadBarrier: Promise<void> = Promise.resolve();
  let resolveMlxLoadBarrier: (() => void) | null = null;

  let mlxLoadUiActive = false;

  /** Set while `preloadWorker` runs for a new client during a model swap (cancellable). */
  let mlxSwapInFlightNewClient: MlxLmStdioTextLlm | null = null;
  let mlxLoadCancelled = false;

  const beginMlxModelLoad = (opts?: { canCancel?: boolean }): void => {
    mlxLoadUiActive = true;
    mlxLoadBarrier = new Promise<void>((resolve) => {
      resolveMlxLoadBarrier = resolve;
    });
    broadcast("mlx_loading", {
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
    broadcast("mlx_loading", { loading: false });
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
    try {
      await fn();
    } finally {
      release();
    }
  };

  /** Mutable when MLX web swaps models; null if no LLM configured. */
  const textLlmRef: { current: TextLlm } | null = (() => {
    const base = resolveTextLlmFromEnv();
    if (!base) return null;
    if (base instanceof MlxLmStdioTextLlm) {
      const replacement = new MlxLmStdioTextLlm({
        ...mlxLmOptionsFromEnv(base.modelId),
        onWorkerStderr: (chunk: string) => {
          broadcast("mlx_load_progress", { chunk });
        },
      });
      void base.dispose().catch(() => {
        /* ignore */
      });
      return { current: replacement };
    }
    return { current: base };
  })();

  const broadcastTextLlmState = (): void => {
    if (!textLlmRef) return;
    const c = textLlmRef.current;
    broadcast("text_llm", { providerId: c.providerId, modelId: c.modelId });
    broadcast("mlx_model", { modelId: c.modelId });
  };

  const swapTextLlmTo = async (
    nextProvider: TextLlmProviderId,
    nextModelId: string,
  ): Promise<void> => {
    if (!textLlmRef) {
      throw new Error("No text LLM configured");
    }
    const prev = textLlmRef.current;
    if (prev.providerId === nextProvider && prev.modelId === nextModelId) {
      return;
    }

    if (nextProvider === "mlx") {
      if (!mlxBackendAvailableFromEnv()) {
        throw new Error("MLX not configured in environment");
      }
      if (!isAllowedMlxWebModelId(nextModelId)) {
        throw new Error("Unknown or disallowed MLX model id");
      }
      await runMlxSwap(async () => {
        beginMlxModelLoad({ canCancel: true });
        mlxLoadCancelled = false;
        try {
          const oldClient = textLlmRef!.current;
          if (oldClient instanceof MlxLmStdioTextLlm) {
            await oldClient.waitForIdle();
          }
          process.stderr.write(
            `adventure-llm: switching to MLX model ${nextModelId}…\n`,
          );
          const created = createMlxTextLlmFromEnv(nextModelId, {
            onWorkerStderr: (chunk) =>
              broadcast("mlx_load_progress", { chunk }),
          });
          mlxSwapInFlightNewClient = created;
          try {
            await created.preloadWorker();
          } catch (loadErr) {
            if (mlxLoadCancelled) {
              broadcast("mlx_load_cancelled", {
                providerId: textLlmRef!.current.providerId,
                modelId: textLlmRef!.current.modelId,
              });
              broadcastTextLlmState();
              return;
            }
            throw loadErr;
          } finally {
            mlxSwapInFlightNewClient = null;
            mlxLoadCancelled = false;
          }
          if (oldClient instanceof MlxLmStdioTextLlm) {
            await oldClient.dispose();
          }
          textLlmRef!.current = created;
          broadcastTextLlmState();
        } finally {
          endMlxModelLoad();
        }
      });
      return;
    }

    if (nextProvider === "http") {
      if (!httpBackendAvailableFromEnv()) {
        throw new Error("HTTP text LLM not configured");
      }
      if (!isAllowedHttpWebModelId(nextModelId)) {
        throw new Error("Unknown or disallowed HTTP model id");
      }
      const nu = createHttpTextLlmFromEnv(nextModelId);
      if (!nu) {
        throw new Error("HTTP text LLM not configured");
      }
      await runMlxSwap(async () => {
        const oc = textLlmRef!.current;
        if (oc instanceof MlxLmStdioTextLlm) {
          await oc.waitForIdle();
          await oc.dispose();
        }
        textLlmRef!.current = nu;
        broadcastTextLlmState();
      });
      return;
    }

    if (nextProvider === "google") {
      if (!googleBackendAvailableFromEnv()) {
        throw new Error("Gemini not configured");
      }
      if (!isAllowedGoogleWebModelId(nextModelId)) {
        throw new Error("Unknown or disallowed Gemini model id");
      }
      const nu = createGoogleTextLlmFromEnv(nextModelId);
      if (!nu) {
        throw new Error("Gemini not configured");
      }
      await runMlxSwap(async () => {
        const oc = textLlmRef!.current;
        if (oc instanceof MlxLmStdioTextLlm) {
          await oc.waitForIdle();
          await oc.dispose();
        }
        textLlmRef!.current = nu;
        broadcastTextLlmState();
      });
    }
  };

  const db = existsSync(datPath) ? loadDatFile(datPath) : null;

  let plannerAutoplayEnabled = true;
  /** Optional overrides (set via POST /api/autoplay-settings); read live during autoplay. */
  let webAutoplayOverrides: AutoplayRunOverrides = {};
  /** Passed to {@link runAutoplaySessionWithTextLlm} so pace/max update without restarting the session. */
  const webAutoplayLiveOverrides: AutoplayRunOverrides = {
    getPaceMs: () =>
      webAutoplayOverrides.paceMs !== undefined
        ? webAutoplayOverrides.paceMs
        : resolveAutoplayPaceMs(),
    getMaxMoves: () =>
      webAutoplayOverrides.maxMoves !== undefined
        ? webAutoplayOverrides.maxMoves
        : resolveAutoplayMaxMoves(),
  };
  let latestTranscript = "";
  let manualPending: ManualPending | null = null;

  const manualPlannerGate: AutoplayManualPlannerGate = {
    isPlannerEnabled: () => plannerAutoplayEnabled,
    waitForManualLine: () =>
      new Promise((resolve) => {
        const intervalId = setInterval(() => {
          if (plannerAutoplayEnabled) {
            clearInterval(intervalId);
            manualPending = null;
            broadcast("manual_waiting", { waitingForManual: false });
            resolve(AUTOPLAY_RESUME_PLANNER);
          }
        }, 200);
        manualPending = {
          resolve: (v) => {
            clearInterval(intervalId);
            manualPending = null;
            broadcast("manual_waiting", { waitingForManual: false });
            resolve(v);
          },
          intervalId,
        };
        broadcast("manual_waiting", { waitingForManual: true });
      }),
  };

  const sink: AutoplayUiSink = {
    forwardGameOutputToTerminal: false,
    onSessionStart: (e) => broadcast("session_start", e),
    onSessionEnd: () => broadcast("session_end", {}),
    beforePlannerCall: awaitMlxModelReady,
    onPlannerPhase: (e) => broadcast("planner_phase", e),
    onPlannerPrompt: (e) => broadcast("planner_prompt", e),
    onTranscriptChunk: (text, step) => {
      latestTranscript += text;
      broadcast("transcript_delta", { text, step });
    },
    onTurnEnd: (e) => {
      latestTranscript = e.transcriptSoFar;
      broadcast("turn_end", e);
    },
    onPlanApplied: (e) => broadcast("plan_applied", e),
    onLogLine: (line, step) => broadcast("log_line", { line, step }),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const pathname = url.pathname === "" ? "/" : url.pathname;

    if (pathname === "/api/autoplay-mode" && req.method === "GET") {
      jsonResponse(res, 200, {
        plannerEnabled: plannerAutoplayEnabled,
        waitingForManual: manualPending !== null,
      });
      return;
    }

    if (pathname === "/api/autoplay-mode" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          plannerEnabled?: boolean;
        } | null;
        if (body === null || typeof body.plannerEnabled !== "boolean") {
          jsonResponse(res, 400, {
            error: "Expected { plannerEnabled: boolean }",
          });
          return;
        }
        plannerAutoplayEnabled = body.plannerEnabled;
        broadcast("autoplay_mode", { plannerEnabled: plannerAutoplayEnabled });
        jsonResponse(res, 200, { plannerEnabled: plannerAutoplayEnabled });
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON" });
      }
      return;
    }

    if (pathname === "/api/autoplay-settings" && req.method === "GET") {
      jsonResponse(res, 200, {
        paceMs:
          webAutoplayOverrides.paceMs !== undefined
            ? webAutoplayOverrides.paceMs
            : resolveAutoplayPaceMs(),
        maxMoves:
          webAutoplayOverrides.maxMoves !== undefined
            ? webAutoplayOverrides.maxMoves
            : resolveAutoplayMaxMoves(),
      });
      return;
    }

    if (pathname === "/api/parser-verbs" && req.method === "GET") {
      if (!db) {
        jsonResponse(res, 503, { error: "adventure.dat not available" });
        return;
      }
      const groups = buildVerbSynonymGroups(db);
      jsonResponse(res, 200, {
        groups: groups.map((g) => g.tokens),
      });
      return;
    }

    if (pathname === "/api/autoplay-settings" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          paceMs?: unknown;
          maxMoves?: unknown;
        } | null;
        if (body === null || typeof body !== "object") {
          jsonResponse(res, 400, { error: "Expected JSON object" });
          return;
        }
        if (body.paceMs !== undefined) {
          const n = Number(body.paceMs);
          if (!Number.isFinite(n) || n < 0 || n > 3_600_000) {
            jsonResponse(res, 400, { error: "paceMs must be 0..3600000" });
            return;
          }
          webAutoplayOverrides = {
            ...webAutoplayOverrides,
            paceMs: Math.floor(n),
          };
        }
        if (body.maxMoves !== undefined) {
          const n = Number(body.maxMoves);
          if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
            jsonResponse(res, 400, { error: "maxMoves must be 1..1000000" });
            return;
          }
          webAutoplayOverrides = {
            ...webAutoplayOverrides,
            maxMoves: Math.floor(n),
          };
        }
        const outPace =
          webAutoplayOverrides.paceMs !== undefined
            ? webAutoplayOverrides.paceMs
            : resolveAutoplayPaceMs();
        const outMax =
          webAutoplayOverrides.maxMoves !== undefined
            ? webAutoplayOverrides.maxMoves
            : resolveAutoplayMaxMoves();
        broadcast("autoplay_settings", { paceMs: outPace, maxMoves: outMax });
        jsonResponse(res, 200, { paceMs: outPace, maxMoves: outMax });
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON" });
      }
      return;
    }

    if (pathname === "/api/text-llm" && req.method === "GET") {
      const backends = buildTextLlmBackendSnapshots();
      if (!textLlmRef) {
        jsonResponse(res, 200, {
          current: null,
          backends,
          canSwap: false,
        });
        return;
      }
      const c = textLlmRef.current;
      jsonResponse(res, 200, {
        current: { providerId: c.providerId, modelId: c.modelId },
        backends,
        canSwap: canSwapTextLlmFromBackends(backends),
      });
      return;
    }

    if (pathname === "/api/mlx-model" && req.method === "GET") {
      const backends = buildTextLlmBackendSnapshots();
      if (!textLlmRef) {
        jsonResponse(res, 200, {
          canSwap: false,
          modelId: "",
          presets: [...MLX_WEB_MODEL_PRESETS],
        });
        return;
      }
      const canSwap =
        textLlmRef.current.providerId === "mlx" &&
        canSwapTextLlmFromBackends(backends);
      jsonResponse(res, 200, {
        canSwap,
        modelId: textLlmRef.current.modelId,
        presets: [...MLX_WEB_MODEL_PRESETS],
      });
      return;
    }

    if (pathname === "/api/mlx-model/cancel" && req.method === "POST") {
      if (mlxSwapInFlightNewClient === null) {
        jsonResponse(res, 400, {
          error: "No cancellable model load in progress (swap only)",
        });
        return;
      }
      mlxLoadCancelled = true;
      const toDispose = mlxSwapInFlightNewClient;
      mlxSwapInFlightNewClient = null;
      try {
        await toDispose.dispose();
      } catch {
        /* dispose may throw if already torn down */
      }
      jsonResponse(res, 200, { ok: true, cancelled: true });
      return;
    }

    if (pathname === "/api/text-llm" && req.method === "POST") {
      if (!textLlmRef) {
        jsonResponse(res, 503, { error: "No text LLM configured" });
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
          jsonResponse(res, 400, {
            error:
              'Expected { providerId: "mlx"|"http"|"google", modelId: string }',
          });
          return;
        }
        await swapTextLlmTo(pid, mid);
        jsonResponse(res, 200, {
          providerId: textLlmRef.current.providerId,
          modelId: textLlmRef.current.modelId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Model swap failed";
        const clientErr =
          /not configured|Unknown or disallowed|Expected \{/.test(msg);
        jsonResponse(res, clientErr ? 400 : 500, { error: msg });
      }
      return;
    }

    if (pathname === "/api/mlx-model" && req.method === "POST") {
      if (!textLlmRef) {
        jsonResponse(res, 503, { error: "No text LLM configured" });
        return;
      }
      try {
        const body = (await readJsonBody(req)) as { modelId?: string } | null;
        const raw =
          body !== null && typeof body.modelId === "string" ? body.modelId : "";
        const nextId = raw.trim();
        if (nextId === "" || !isAllowedMlxWebModelId(nextId)) {
          jsonResponse(res, 400, { error: "Unknown or disallowed modelId" });
          return;
        }
        await swapTextLlmTo("mlx", nextId);
        jsonResponse(res, 200, { modelId: textLlmRef.current.modelId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Model swap failed";
        const clientErr = /not configured|Unknown or disallowed/.test(msg);
        jsonResponse(res, clientErr ? 400 : 500, { error: msg });
      }
      return;
    }

    if (pathname === "/api/manual-command" && req.method === "POST") {
      if (!textLlmRef || !db) {
        jsonResponse(res, 503, {
          error: "Text LLM or adventure.dat not available",
        });
        return;
      }
      const pend = manualPending;
      if (pend === null) {
        jsonResponse(res, 409, {
          error:
            "Not waiting for a manual command (enable manual mode and wait for the prompt)",
        });
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
          jsonResponse(res, 400, { error: "Expected JSON body" });
          return;
        }
        if (body.endSession === true) {
          pend.resolve(null);
          jsonResponse(res, 200, { ok: true, action: "endSession" });
          return;
        }
        if (typeof body.natural === "string" && body.natural.trim() !== "") {
          const interpreted = await interpretWithTextLlm(
            body.natural.trim(),
            db,
            textLlmRef.current,
            {
              recentGameText: latestTranscript.slice(-8000),
            },
          );
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
          jsonResponse(res, 200, { ok: true, action: "natural" });
          return;
        }
        if (
          typeof body.getinLine === "string" &&
          body.getinLine.trim() !== ""
        ) {
          pend.resolve(body.getinLine.trimEnd());
          jsonResponse(res, 200, { ok: true, action: "getinLine" });
          return;
        }
        jsonResponse(res, 400, {
          error:
            'Provide endSession: true, getinLine: "EAST ...", or natural: "go east"',
        });
      } catch (e) {
        jsonResponse(res, 400, {
          error: e instanceof Error ? e.message : "Request failed",
        });
      }
      return;
    }

    if (pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      sseWrite(res, "autoplay_mode", {
        plannerEnabled: plannerAutoplayEnabled,
      });
      sseWrite(res, "autoplay_settings", {
        paceMs:
          webAutoplayOverrides.paceMs !== undefined
            ? webAutoplayOverrides.paceMs
            : resolveAutoplayPaceMs(),
        maxMoves:
          webAutoplayOverrides.maxMoves !== undefined
            ? webAutoplayOverrides.maxMoves
            : resolveAutoplayMaxMoves(),
      });
      sseWrite(res, "manual_waiting", {
        waitingForManual: manualPending !== null,
      });
      if (db) {
        sseWrite(res, "parser_verbs", {
          groups: buildVerbSynonymGroups(db).map((g) => g.tokens),
        });
      } else {
        sseWrite(res, "parser_verbs", { groups: [], datAvailable: false });
      }
      if (textLlmRef) {
        const cur = textLlmRef.current;
        sseWrite(res, "text_llm", {
          providerId: cur.providerId,
          modelId: cur.modelId,
        });
        sseWrite(res, "mlx_model", { modelId: cur.modelId });
        if (cur.providerId === "mlx" && mlxLoadUiActive) {
          sseWrite(res, "mlx_loading", {
            loading: true,
            message: "Loading MLX model…",
            resetProgress: true,
            canCancel: mlxSwapInFlightNewClient !== null,
          });
        }
      }
      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });

      if (!textLlmRef) {
        sseWrite(res, "session_error", {
          message:
            "No text LLM configured (GEMINI_API_KEY, ADVENTURE_LLM_HTTP_MODEL, or MLX). See adventure-llm/.env.example.",
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

      if (!autoplayRunning && !autoplayStartScheduled) {
        autoplayStartScheduled = true;
        autoplayRunning = (async () => {
          try {
            if (textLlmRef.current instanceof MlxLmStdioTextLlm) {
              beginMlxModelLoad();
              try {
                await ensureMlxWorkerReady(textLlmRef.current);
              } finally {
                endMlxModelLoad();
              }
            } else {
              await ensureMlxWorkerReady(textLlmRef.current);
            }
            await runAutoplaySessionWithTextLlm(
              textLlmRef,
              { repoRoot, datPath },
              sink,
              manualPlannerGate,
              webAutoplayLiveOverrides,
            );
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : `autoplay failed: ${String(err)}`;
            broadcast("session_error", { message: msg });
            if (
              shouldFallbackToClassicForLlmError(
                err,
                textLlmRef.current.providerId,
              )
            ) {
              broadcast("log_line", {
                line: "adventure-llm: text LLM unavailable (quota, rate limit, network, or service error).\n",
              });
            }
          } finally {
            autoplayRunning = null;
            autoplayStartScheduled = false;
          }
        })();
      }
      return;
    }

    const filePath = path.join(
      publicDir,
      pathname === "/" ? "index.html" : pathname.slice(1),
    );
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
      base === "index.html" || base === "app.js" || base === "dashboard.css";
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      ...(noCacheDashboardAsset ? { "Cache-Control": "no-store" } : {}),
    });
    createReadStream(filePath).pipe(res);
  });

  return server;
}

async function main(): Promise<void> {
  const logPath = resolveDebugLogPath();
  if (logPath) {
    process.stderr.write(`adventure-llm: interaction log → ${logPath}\n`);
  }

  const port = resolveWebPort();
  const server = createAutoplayDashboardServer();
  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `adventure-llm: autoplay web dashboard → http://127.0.0.1:${port}/\n`,
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
