/**
 * Client-side NL loop (ADR0005 / ADR0014): consumes SSE getin_prompt_ready, runs @adventure-nl/nl-glue
 * from the cognition bundle, runs autoplay planning in the browser (Gemini or OpenAI-compatible HTTP),
 * then POST /api/engine/input for Fortran GETIN. “Autoplay” names the self-acting loop, not server-side NL.
 */
import { applySnapshot } from "./mapView.js";
import { parseSseJson } from "./sseJson.js";

/**
 * @param {{ fetch: typeof fetch; location: Location }} ports
 * @param {ReturnType<import("./dashboardApi.js").createDashboardApi>} api
 * @param {EventSource} es
 */
export function wireBrowserAutoplayOrchestrator(ports, api, es) {
  const origin = ports.location.origin;
  const bundleUrl = new URL(
    "/generated/browserAutoplayCognition.js",
    origin + "/",
  ).href;

  let ready = false;
  let modPromise = null;

  let db = null;
  let memory = null;

  let lastGetinLine = "";
  let moveNumber = 0;
  let contextChars = 6000;

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

  async function ensureCognition() {
    if (ready) return;
    const r = await api.getAdventureDatabase();
    if (!r.ok) throw new Error("Could not load adventure database snapshot");
    const j = await r.json();
    const mod = await loadBundle();
    db = mod.deserializeAdventureDatabaseFromJson(j.database);
    memory = new mod.AutoplaySessionMemory();
    contextChars = mod.resolveAutoplayContextChars();
    ready = true;
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

  async function ensurePlannerSnapshot() {
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

  es.addEventListener("getin_prompt_ready", (ev) => {
    void (async () => {
      const d = parseSseJson(/** @type {MessageEvent} */ (ev).data);
      if (!d || typeof d.transcriptSoFar !== "string") return;
      try {
        await ensureCognition();
        const mod = await loadBundle();
        const phase =
          d.phase === "first" || d.phase === "continue" ? d.phase : "continue";
        const gameOut =
          typeof d.gameOutputSinceLastCommand === "string"
            ? d.gameOutputSinceLastCommand
            : "";
        if (phase === "first") {
          memory.seedOpening(d.transcriptSoFar, { adventureDb: db });
        } else if (lastGetinLine.length > 0) {
          memory.recordCommandOutcome(lastGetinLine, gameOut, {
            adventureDb: db,
          });
        }

        if (mod.gameOutputLooksLikePlayAgainPrompt(gameOut)) {
          moveNumber += 1;
          const line = "Y";
          const plan = { primaryToken: "Y", continuePlaying: true };
          const er = await api.postEngineInput({
            getinLine: line,
            plan,
            moveNumber,
            motionGridHint: null,
          });
          if (!er.ok) throw new Error("engine input failed (play again)");
          lastGetinLine = line;
          return;
        }

        const plannerSnap = await ensurePlannerSnapshot();
        if (plannerSnap.providerId === "mlx") {
          console.error(
            "adventure-nl: browser autoplay planning needs google or http text provider (MLX uses a server-side worker). Switch provider or set ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0 for server-side NL.",
          );
          return;
        }
        if (
          !plannerCredentialsReady(
            plannerSnap.providerId,
            plannerSnap.browserPlanner,
          )
        ) {
          console.error(
            "adventure-nl: missing browser planner credentials (expect googleApiKey or httpBaseUrl from SSE / GET /api/text-llm)",
          );
          return;
        }

        const overrides = await getPlannerOverrides();
        const inv = mod.buildAutoplayPlannerInvocation({
          db,
          memory,
          contextChars,
          providerId: plannerSnap.providerId,
          recentForRepairRaw: phase === "first" ? d.transcriptSoFar : gameOut,
          overrides,
        });

        let plan = await mod.planAutoplayInBrowser(
          db,
          {
            plannerUserPrompt: inv.plannerUserPrompt,
            recentGameTextForRepair: inv.recentGameTextForRepair,
            includeDatHelpInSystem: inv.includeDatHelpInSystem,
          },
          {
            providerId: plannerSnap.providerId,
            modelId: plannerSnap.modelId,
            browserPlanner: plannerSnap.browserPlanner,
          },
        );
        plan = mod.planAfterAutoplayGuards(memory, plan, () => {});
        const scripted = mod.plannerToScriptedGetin(plan);
        const getinLine =
          typeof scripted === "string" ? scripted : scripted.line;
        moveNumber += 1;
        if (plan.continuePlaying === false) {
          const er = await api.postEngineInput({
            getinLine,
            plan,
            moveNumber,
            motionGridHint: null,
          });
          if (!er.ok) throw new Error("engine input failed (stop)");
          lastGetinLine = getinLine;
          return;
        }
        const er = await api.postEngineInput({
          getinLine,
          plan,
          moveNumber,
          motionGridHint: null,
        });
        if (!er.ok) throw new Error("engine input failed");
        lastGetinLine = getinLine;

        const uiSnap = memory.buildAutoplayUiSnapshot();
        applySnapshot(uiSnap);
      } catch (e) {
        console.error("adventure-nl: browser autoplay cognition", e);
      }
    })();
  });
}
