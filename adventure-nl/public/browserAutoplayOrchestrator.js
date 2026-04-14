/**
 * Client-side NL loop (ADR0005 / ADR0014 / ADR0016): SSE `getin_prompt_ready` drives an XState
 * cognition actor (`createBrowserAutoplayCognitionActor`); optional Glue MCP when
 * `localStorage.adventureNlGlueMcp === '1'`.
 */
import {
  resolveCognitionOrchestrationElements,
  subscribeCognitionOrchestrationPanel,
} from "./cognitionOrchestrationPanel.js";
import { applySnapshot } from "./mapView.js";
import { parseSseJson } from "./sseJson.js";

/**
 * @param {{ fetch: typeof fetch; location: Location; localStorage: Storage }} ports
 * @param {ReturnType<import("./dashboardApi.js").createDashboardApi>} api
 * @param {EventSource} es
 */
export function wireBrowserAutoplayOrchestrator(ports, api, es) {
  const origin = ports.location.origin;
  const bundleUrl = new URL(
    "/generated/browserAutoplayCognition.js",
    origin + "/",
  ).href;

  let modPromise = null;

  let useGlueMcp = false;
  try {
    useGlueMcp = ports.localStorage.getItem("adventureNlGlueMcp") === "1";
  } catch {
    useGlueMcp = false;
  }

  /** Avoid GET /api/prompt-experiment and GET /api/text-llm on every planner step; SSE keeps these fresh. */
  let cachedPromptPatch = null;
  let cachedProviderId = null;
  let cachedModelId = null;
  /** @type {Record<string, unknown> | null} */
  let cachedBrowserPlanner = null;

  es.addEventListener("prompt_experiment", (ev) => {
    const d = parseSseJson(/** @type {MessageEvent} */ (ev).data);
    if (d && d.patch && typeof d.patch === "object") {
      cachedPromptPatch = d.patch;
    }
  });

  es.addEventListener("prompt_project", () => {
    cachedPromptPatch = null;
  });

  es.addEventListener("text_llm", (ev) => {
    const d = parseSseJson(/** @type {MessageEvent} */ (ev).data);
    if (d && typeof d.providerId === "string" && d.providerId.length > 0) {
      cachedProviderId = d.providerId;
    }
    if (d && typeof d.modelId === "string" && d.modelId.length > 0) {
      cachedModelId = d.modelId;
    }
    if (d && d.browserPlanner && typeof d.browserPlanner === "object") {
      cachedBrowserPlanner = d.browserPlanner;
    }
  });

  es.addEventListener("mlx_model", (ev) => {
    const d = parseSseJson(/** @type {MessageEvent} */ (ev).data);
    const pid =
      typeof d.providerId === "string" && d.providerId.trim() !== ""
        ? d.providerId.trim()
        : "mlx";
    cachedProviderId = pid;
    if (typeof d.modelId === "string" && d.modelId.length > 0) {
      cachedModelId = d.modelId;
    }
  });

  async function loadBundle() {
    if (modPromise) return modPromise;
    modPromise = import(/* @vite-ignore */ bundleUrl);
    return modPromise;
  }

  async function getPlannerOverrides() {
    if (cachedPromptPatch !== null) {
      const patch = cachedPromptPatch;
      return {
        getPlannerPromptExperiment: () => patch,
      };
    }
    const pr = await ports.fetch("/api/prompt-experiment", {
      credentials: "same-origin",
    });
    if (!pr.ok) return {};
    const j = await pr.json();
    const patch = j.patch && typeof j.patch === "object" ? j.patch : {};
    cachedPromptPatch = patch;
    return {
      getPlannerPromptExperiment: () => patch,
    };
  }

  /**
   * @param {string} providerId
   * @param {Record<string, unknown> | null} bp
   */
  function plannerCredentialsReady(providerId, bp) {
    if (!bp || typeof bp !== "object") return false;
    if (providerId === "google") {
      return typeof bp.googleApiKey === "string" && bp.googleApiKey.length > 0;
    }
    if (providerId === "http") {
      return typeof bp.httpBaseUrl === "string" && bp.httpBaseUrl.length > 0;
    }
    return false;
  }

  async function getPlannerSnapshot() {
    if (
      cachedProviderId !== null &&
      cachedModelId !== null &&
      cachedProviderId === "mlx"
    ) {
      return {
        providerId: cachedProviderId,
        modelId: cachedModelId,
        browserPlanner: cachedBrowserPlanner,
      };
    }
    if (
      cachedProviderId !== null &&
      cachedModelId !== null &&
      (cachedProviderId === "google" || cachedProviderId === "http") &&
      plannerCredentialsReady(cachedProviderId, cachedBrowserPlanner)
    ) {
      return {
        providerId: cachedProviderId,
        modelId: cachedModelId,
        browserPlanner: cachedBrowserPlanner,
      };
    }
    const tr = await ports.fetch("/api/text-llm", {
      credentials: "same-origin",
    });
    if (!tr.ok) {
      return {
        providerId: cachedProviderId ?? "mlx",
        modelId: cachedModelId ?? "",
        browserPlanner: cachedBrowserPlanner,
      };
    }
    const tj = await tr.json();
    const cur = tj.current;
    if (
      cur &&
      typeof cur.providerId === "string" &&
      cur.providerId.length > 0
    ) {
      cachedProviderId = cur.providerId;
    }
    if (cur && typeof cur.modelId === "string" && cur.modelId.length > 0) {
      cachedModelId = cur.modelId;
    }
    if (tj.browserPlanner && typeof tj.browserPlanner === "object") {
      cachedBrowserPlanner = tj.browserPlanner;
    }
    return {
      providerId: cachedProviderId ?? "mlx",
      modelId: cachedModelId ?? "",
      browserPlanner: cachedBrowserPlanner,
    };
  }

  /** @type {null | { send: (ev: unknown) => void }} */
  let cognitionActor = null;
  /** @type {(() => void) | null} */
  let unsubscribePanel = null;

  async function ensureCognitionActor() {
    if (cognitionActor) return cognitionActor;
    const mod = await loadBundle();
    let glueMcpHost = null;
    const effectiveUseGlue = useGlueMcp;
    if (effectiveUseGlue) {
      try {
        const workerUrl = new URL("/generated/glueMcpWorker.js", origin + "/")
          .href;
        const w = new Worker(workerUrl, { type: "module" });
        glueMcpHost = new mod.GlueMcpWorkerHost(w);
        await glueMcpHost.initialize();
      } catch (e) {
        console.error("adventure-nl: Glue MCP worker init failed", e);
        glueMcpHost = null;
      }
    }

    const input = {
      loadCognitionModule: () => loadBundle(),
      getAdventureDatabase: () => api.getAdventureDatabase(),
      postEngineInput: (body) => api.postEngineInput(body),
      getPlannerSnapshot,
      getPlannerOverrides,
      applySnapshot,
      glueMcpHost,
      useGlueMcp: Boolean(glueMcpHost),
    };

    cognitionActor = mod.createBrowserAutoplayCognitionActor(input);

    const panelEls = resolveCognitionOrchestrationElements(document);
    if (unsubscribePanel) unsubscribePanel();
    unsubscribePanel = subscribeCognitionOrchestrationPanel(
      cognitionActor,
      panelEls,
    );

    const mlx = cachedProviderId === "mlx";
    const noCreds =
      (cachedProviderId === "google" || cachedProviderId === "http") &&
      !plannerCredentialsReady(cachedProviderId, cachedBrowserPlanner);
    if (mlx || noCreds) {
      const hint = mlx
        ? "MLX uses a server-side worker; switch text provider to google or http for browser autoplay."
        : "Add browser planner credentials (SSE text_llm or GET /api/text-llm).";
      if (panelEls.contextEl) {
        panelEls.contextEl.textContent = `Planner: ${hint}`;
      }
    }

    return cognitionActor;
  }

  es.addEventListener("getin_prompt_ready", (ev) => {
    void (async () => {
      const d = parseSseJson(/** @type {MessageEvent} */ (ev).data);
      if (!d || typeof d.transcriptSoFar !== "string") return;
      try {
        const actor = await ensureCognitionActor();
        actor.send({
          type: "ENGINE.GETIN_PROMPT_READY",
          transcriptSoFar: d.transcriptSoFar,
          phase: d.phase,
          gameOutputSinceLastCommand: d.gameOutputSinceLastCommand,
        });
      } catch (e) {
        console.error("adventure-nl: browser autoplay cognition", e);
      }
    })();
  });
}
