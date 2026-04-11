/**
 * Browser-orchestrated autoplay (ADR0005): consumes SSE getin_prompt_ready, runs client-side glue
 * from the cognition bundle, calls POST /api/autoplay-plan, submits GETIN via POST /api/autoplay-engine-input.
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
    const pr = await ports.fetch("/api/prompt-experiment", {
      credentials: "same-origin",
    });
    if (!pr.ok) return {};
    const j = await pr.json();
    const patch = j.patch && typeof j.patch === "object" ? j.patch : {};
    return {
      getPlannerPromptExperiment: () => patch,
    };
  }

  async function getActiveProviderId() {
    const tr = await ports.fetch("/api/text-llm", {
      credentials: "same-origin",
    });
    if (!tr.ok) return "mlx";
    const tj = await tr.json();
    const pid = tj.current?.providerId;
    return typeof pid === "string" && pid.length > 0 ? pid : "mlx";
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
          const er = await api.postAutoplayEngineInput({
            getinLine: line,
            plan,
            moveNumber,
            motionGridHint: null,
          });
          if (!er.ok) throw new Error("engine input failed (play again)");
          lastGetinLine = line;
          return;
        }

        const overrides = await getPlannerOverrides();
        const providerId = await getActiveProviderId();
        const inv = mod.buildAutoplayPlannerInvocation({
          db,
          memory,
          contextChars,
          providerId,
          recentForRepairRaw: phase === "first" ? d.transcriptSoFar : gameOut,
          overrides,
        });

        const planRes = await api.postAutoplayPlan({
          plannerUserPrompt: inv.plannerUserPrompt,
          recentGameTextForRepair: inv.recentGameTextForRepair,
          includeDatHelpInSystem: inv.includeDatHelpInSystem,
        });
        if (!planRes.ok) {
          const err = await planRes.json().catch(() => ({}));
          throw new Error(err.error || `autoplay-plan ${planRes.status}`);
        }
        const pj = await planRes.json();
        let plan = pj.plan;
        plan = mod.planAfterAutoplayGuards(memory, plan, () => {});
        const scripted = mod.plannerToScriptedGetin(plan);
        const getinLine =
          typeof scripted === "string" ? scripted : scripted.line;
        moveNumber += 1;
        if (plan.continuePlaying === false) {
          const er = await api.postAutoplayEngineInput({
            getinLine,
            plan,
            moveNumber,
            motionGridHint: null,
          });
          if (!er.ok) throw new Error("engine input failed (stop)");
          lastGetinLine = getinLine;
          return;
        }
        const er = await api.postAutoplayEngineInput({
          getinLine,
          plan,
          moveNumber,
          motionGridHint: null,
        });
        if (!er.ok) throw new Error("engine input failed");
        lastGetinLine = getinLine;

        const snap = memory.buildAutoplayUiSnapshot();
        applySnapshot(snap);
      } catch (e) {
        console.error("adventure-lm: browser autoplay cognition", e);
      }
    })();
  });
}
