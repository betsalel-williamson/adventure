/**
 * Autoplay dashboard: EventSource consumer for /events.
 */

import { AUTOPLAY_PACE_PRESETS, snapPaceMsToPreset } from "./autoplayPace.js";
import { createDashboardApi } from "./dashboardApi.js";
import { registerDashboardEventHandlers } from "./dashboardEventStream.js";
import { bindDashboardElements, elements } from "./dashboardElementRefs.js";
import { defaultPorts, resolveDashboardElements } from "./dashboardEnv.js";
import { renderMapSlice } from "./mapView.js";
import { createPromptLab } from "./promptLab.js";
import { state } from "./dashboardState.js";
import {
  wireCopyPromptButtonsFromElements,
  wireDashboardHelpDialogs,
  wireMapScrollAndResize,
  wireMapVisualTabs,
  wireMermaidFullscreenDialog,
} from "./dashboardWidgets.js";
import {
  paceMsToTypingWpm,
  TERMINAL_TYPING_PRE_ENTER_MS,
  wpmToCharDelayMs,
} from "./terminalTyper.js";
import {
  appendTerminalCommandEcho,
  applyTranscriptLayout,
  initTranscriptLayout,
  isTerminalTranscriptLayout,
  renderTranscriptFeed,
  wireTranscriptFeedScrollIntent,
} from "./transcriptView.js";

bindDashboardElements(resolveDashboardElements(document));
const ports = defaultPorts();
const api = createDashboardApi(ports);
const promptLab = createPromptLab(ports, elements);
promptLab.wirePromptLab();

const MLX_LOAD_PROGRESS_MAX = 120000;

function clearMlxLoadProgressText() {
  if (elements?.mlxLoadProgressEl) elements.mlxLoadProgressEl.textContent = "";
}

/**
 * @param {string} chunk
 */
function appendMlxLoadProgress(chunk) {
  const el = elements;
  if (!el?.mlxLoadProgressEl || typeof chunk !== "string" || chunk === "")
    return;
  let next = el.mlxLoadProgressEl.textContent + chunk;
  if (next.length > MLX_LOAD_PROGRESS_MAX) {
    next = `…(truncated)\n${next.slice(-(MLX_LOAD_PROGRESS_MAX - 32))}`;
  }
  el.mlxLoadProgressEl.textContent = next;
  el.mlxLoadProgressEl.scrollTop = el.mlxLoadProgressEl.scrollHeight;
}

/**
 * @param {boolean} show
 */
function setMlxLoadOverlayVisible(show) {
  if (!elements?.mlxLoadOverlay) return;
  elements.mlxLoadOverlay.classList.toggle("hidden", !show);
  elements.mlxLoadOverlay.setAttribute("aria-hidden", show ? "false" : "true");
  document.body.classList.toggle("mlx-loading", show);
}

function setAutoplayPaceSelectValue(ms) {
  const el = elements;
  if (!el?.autoplayPaceMsEl) return;
  el.autoplayPaceMsEl.value = String(snapPaceMsToPreset(ms));
}

function initAutoplayPaceSelect() {
  const el = elements;
  if (!el?.autoplayPaceMsEl || el.autoplayPaceMsEl.tagName !== "SELECT") return;
  el.autoplayPaceMsEl.replaceChildren();
  for (const { label, ms } of AUTOPLAY_PACE_PRESETS) {
    const opt = document.createElement("option");
    opt.value = String(ms);
    opt.textContent = label;
    el.autoplayPaceMsEl.appendChild(opt);
  }
  const normalPreset =
    AUTOPLAY_PACE_PRESETS.find((p) => p.ms === 500) ?? AUTOPLAY_PACE_PRESETS[0];
  el.autoplayPaceMsEl.value = String(normalPreset.ms);
}

initAutoplayPaceSelect();

function typingTimingFromPaceSelect() {
  const el = elements;
  const raw = Number(el?.autoplayPaceMsEl?.value);
  const fallbackMs = AUTOPLAY_PACE_PRESETS.find((p) => p.ms === 500)?.ms ?? 500;
  const paceMs = snapPaceMsToPreset(Number.isFinite(raw) ? raw : fallbackMs);
  if (paceMs === 0) {
    return { charDelayMs: 0, finalPauseMs: 0 };
  }
  const wpm = paceMsToTypingWpm(paceMs);
  return {
    charDelayMs: wpmToCharDelayMs(wpm),
    finalPauseMs: TERMINAL_TYPING_PRE_ENTER_MS,
  };
}

function setSessionStatus(text) {
  if (elements?.sessionStatusEl) elements.sessionStatusEl.textContent = text;
}

function formatAutoplaySessionStatusLine(meta) {
  return `Autoplay: pace ${meta.paceMs}ms, max moves ${meta.maxMoves}, provider ${meta.providerId}`;
}

function applyLiveAutoplaySessionStatusFromPaceAndMax(paceMs, maxMoves) {
  if (!state.activeSessionAutoplayMeta) return;
  state.activeSessionAutoplayMeta = {
    ...state.activeSessionAutoplayMeta,
    paceMs,
    maxMoves,
  };
  const line = formatAutoplaySessionStatusLine(state.activeSessionAutoplayMeta);
  if (state.mlxModelLoadingUi) {
    if (state.sessionStatusBeforeMlxLoad)
      state.sessionStatusBeforeMlxLoad = line;
  } else {
    setSessionStatus(line);
  }
}

function setPlannerThinking(on) {
  if (elements?.spinnerEl) elements.spinnerEl.classList.toggle("hidden", !on);
}

function clearManualError() {
  if (elements?.manualError) elements.manualError.textContent = "";
}

function showManualError(msg) {
  if (elements?.manualError) elements.manualError.textContent = msg;
}

function setManualUiState() {
  const el = elements;
  if (
    !el?.manualBanner ||
    !el.manualInput ||
    !el.manualInterpretToggle ||
    !el.manualSend ||
    !el.manualEndSession ||
    !el.autoplayToggle
  )
    return;
  const plannerOn = el.autoplayToggle.checked;
  el.manualBanner.classList.toggle(
    "hidden",
    !state.waitingForManual || plannerOn,
  );
  const canSend = !plannerOn;
  el.manualInput.disabled = !canSend;
  /* Interpret-with-language-model is a preference; keep it toggleable while autoplay runs. */
  el.manualInterpretToggle.disabled = false;
  el.manualSend.disabled = !canSend;
  el.manualEndSession.disabled = !canSend;
}

async function refreshModeFromServer() {
  try {
    const r = await api.getAutoplayMode();
    if (!r.ok) return;
    const j = await r.json();
    const el = elements;
    if (typeof j.plannerEnabled === "boolean" && el?.autoplayToggle) {
      el.autoplayToggle.checked = j.plannerEnabled;
    }
    if (typeof j.waitingForManual === "boolean") {
      state.waitingForManual = j.waitingForManual;
    }
    setManualUiState();
  } catch {
    /* ignore */
  }
}

const AUTOPLAY_SETTINGS_DEBOUNCE_MS = 400;

function scheduleSaveAutoplaySettings() {
  if (state.autoplaySettingsSaveTimer)
    clearTimeout(state.autoplaySettingsSaveTimer);
  state.autoplaySettingsSaveTimer = setTimeout(() => {
    state.autoplaySettingsSaveTimer = null;
    void saveAutoplaySettingsNow();
  }, AUTOPLAY_SETTINGS_DEBOUNCE_MS);
}

async function saveAutoplaySettingsNow() {
  clearManualError();
  try {
    const el = elements;
    const paceRaw = Number(el?.autoplayPaceMsEl?.value);
    const paceMs = snapPaceMsToPreset(paceRaw);
    const maxMoves = Number(el?.autoplayMaxMovesEl?.value);
    const r = await api.postAutoplaySettings({
      paceMs: Number.isFinite(paceRaw) ? paceMs : undefined,
      maxMoves: Number.isFinite(maxMoves) ? maxMoves : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      showManualError(j.error || "Could not save pace/max.");
      return;
    }
    ports.localStorage.setItem(
      "adventureAutoplaySettings",
      JSON.stringify({ paceMs: j.paceMs, maxMoves: j.maxMoves }),
    );
    setAutoplayPaceSelectValue(j.paceMs);
    if (el?.autoplayMaxMovesEl)
      el.autoplayMaxMovesEl.value = String(j.maxMoves);
    if (typeof j.paceMs === "number" && typeof j.maxMoves === "number") {
      applyLiveAutoplaySessionStatusFromPaceAndMax(j.paceMs, j.maxMoves);
    }
  } catch (e) {
    showManualError(e instanceof Error ? e.message : "Network error");
  }
}

/**
 * LLM interpret (optional) then POST /api/engine/input — same two-phase model as autoplay.
 * @param {Record<string, unknown>} body
 */
async function postManualCommand(body) {
  clearManualError();
  try {
    let r;
    if (typeof body.natural === "string" && body.natural.trim() !== "") {
      const ir = await api.postNlInterpret({ natural: body.natural.trim() });
      const ij = await ir.json().catch(() => ({}));
      if (!ir.ok) {
        const raw = typeof ij.error === "string" ? ij.error : "";
        showManualError(raw || `Interpret failed (${ir.status})`);
        return;
      }
      if (ij.scripted === undefined || ij.scripted === null) {
        showManualError("Interpret response missing scripted line.");
        return;
      }
      r = await api.postEngineInput({ scripted: ij.scripted });
    } else {
      r = await api.postEngineInput(body);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const raw = typeof j.error === "string" ? j.error : "";
      if (r.status === 409 && /not waiting/i.test(raw)) {
        showManualError(
          "Session is not ready for input yet (finishing the previous step or pace delay). Try again in a moment.",
        );
      } else {
        showManualError(raw || `Request failed (${r.status})`);
      }
      return;
    }
    if (elements?.manualInput) elements.manualInput.value = "";
  } catch (e) {
    showManualError(e instanceof Error ? e.message : "Network error");
  }
}

async function submitManualCommand() {
  const el = elements;
  if (!el?.manualInput || !el.manualInterpretToggle) return;
  const line = el.manualInput.value.trim();
  if (!line) {
    showManualError(
      el.manualInterpretToggle.checked
        ? "Enter text for the interpreter to map to parser tokens."
        : "Enter a parser command (e.g. EAST).",
    );
    return;
  }
  if (isTerminalTranscriptLayout()) {
    appendTerminalCommandEcho(line);
    renderTranscriptFeed();
  }
  if (el.manualInterpretToggle.checked) {
    await postManualCommand({ natural: line });
  } else {
    await postManualCommand({ getinLine: line });
  }
}

const TEXT_LLM_OPTGROUP_LABELS = {
  mlx: "Local (MLX)",
  http: "HTTP (OpenAI-compatible)",
  google: "Google (Gemini)",
};

async function initTextLlmPicker() {
  const el = elements;
  if (!el?.textLlmWrap || !el.textLlmSelect) return;
  try {
    const r = await api.getTextLlm();
    if (!r.ok) return;
    const j = await r.json();
    if (!j.canSwap || !Array.isArray(j.backends)) {
      el.textLlmWrap.classList.add("hidden");
      el.textLlmWrap.setAttribute("aria-hidden", "true");
      return;
    }
    const hasAny = j.backends.some((b) => b.available && b.presets.length > 0);
    if (!hasAny) {
      el.textLlmWrap.classList.add("hidden");
      el.textLlmWrap.setAttribute("aria-hidden", "true");
      return;
    }
    el.textLlmWrap.classList.remove("hidden");
    el.textLlmWrap.setAttribute("aria-hidden", "false");
    el.textLlmSelect.replaceChildren();
    for (const b of j.backends) {
      if (!b.available || !b.presets.length) continue;
      const og = document.createElement("optgroup");
      og.label = TEXT_LLM_OPTGROUP_LABELS[b.providerId] || b.providerId;
      for (const preset of b.presets) {
        const opt = document.createElement("option");
        opt.value = JSON.stringify({
          providerId: b.providerId,
          modelId: preset,
        });
        opt.textContent =
          b.providerId === "mlx"
            ? String(preset).replace(/^mlx-community\//, "")
            : preset;
        og.appendChild(opt);
      }
      el.textLlmSelect.appendChild(og);
    }
    const cur = j.current;
    if (
      cur &&
      typeof cur.providerId === "string" &&
      typeof cur.modelId === "string"
    ) {
      const want = JSON.stringify({
        providerId: cur.providerId,
        modelId: cur.modelId,
      });
      if ([...el.textLlmSelect.options].some((o) => o.value === want)) {
        el.textLlmSelect.value = want;
      }
    }
    state.lastTextLlmOptionValue = el.textLlmSelect.value;
  } catch {
    /* ignore */
  }
}

/**
 * @param {string[][]} groups
 * @param {{ datAvailable?: boolean }} [meta]
 */
function renderParserVerbHintGroups(groups, meta) {
  const doc = document;
  const hintEl = doc.getElementById("parser-verb-hints");
  if (!hintEl) return;
  hintEl.replaceChildren();
  if (meta && meta.datAvailable === false) {
    const p = document.createElement("p");
    p.className = "small muted";
    p.textContent =
      "Verb list unavailable (adventure.dat not found on server).";
    hintEl.appendChild(p);
    return;
  }
  const list = Array.isArray(groups) ? groups : [];
  if (list.length === 0) {
    const p = document.createElement("p");
    p.className = "small muted";
    p.textContent = "No verb data.";
    hintEl.appendChild(p);
    return;
  }
  for (const tokens of list) {
    if (!Array.isArray(tokens) || tokens.length === 0) continue;
    const line = document.createElement("p");
    line.className = "parser-verb-hint-line";
    line.textContent = tokens.join(" · ");
    hintEl.appendChild(line);
  }
}

async function applyStoredAutoplaySettings() {
  try {
    const r = await api.getAutoplaySettings();
    const j = r.ok ? await r.json() : {};
    const el = elements;
    if (el?.autoplayPaceMsEl && typeof j.paceMs === "number") {
      setAutoplayPaceSelectValue(j.paceMs);
    }
    if (el?.autoplayMaxMovesEl && typeof j.maxMoves === "number") {
      el.autoplayMaxMovesEl.value = String(j.maxMoves);
    }
    let fromStore = null;
    try {
      fromStore = JSON.parse(
        ports.localStorage.getItem("adventureAutoplaySettings") || "null",
      );
    } catch {
      fromStore = null;
    }
    const body = {};
    if (fromStore && typeof fromStore.paceMs === "number") {
      body.paceMs = snapPaceMsToPreset(fromStore.paceMs);
    }
    if (fromStore && typeof fromStore.maxMoves === "number") {
      body.maxMoves = fromStore.maxMoves;
    }
    if (Object.keys(body).length > 0) {
      const pr = await api.postAutoplaySettings(body);
      if (pr.ok) {
        const j2 = await pr.json();
        setAutoplayPaceSelectValue(j2.paceMs);
        if (el?.autoplayMaxMovesEl)
          el.autoplayMaxMovesEl.value = String(j2.maxMoves);
      }
    }
  } catch {
    /* ignore */
  }
}

let browserOrchestratedAutoplay = false;
{
  const sr = await api.ensureSession();
  if (!sr.ok) {
    console.warn("adventure-nl: session bootstrap failed", sr.status);
  } else {
    const j = await sr.json().catch(() => ({}));
    browserOrchestratedAutoplay = j.browserOrchestratedAutoplay === true;
  }
}
await applyStoredAutoplaySettings();
void promptLab.fetchPromptExperiment();
function scheduleIdle(fn) {
  if (typeof globalThis.requestIdleCallback === "function") {
    globalThis.requestIdleCallback(() => void fn(), { timeout: 2500 });
  } else {
    globalThis.setTimeout(() => void fn(), 1);
  }
}
scheduleIdle(() => {
  void promptLab.refreshProjectList();
  void promptLab.refreshLlmGenFields();
});

const es = new ports.EventSource(new URL("/events", ports.location.href).href);

registerDashboardEventHandlers(es, {
  renderParserVerbHintGroups,
  setManualUiState,
  applyLiveAutoplaySessionStatusFromPaceAndMax,
  setAutoplayPaceSelectValue,
  clearManualError,
  setSessionStatus,
  clearMlxLoadProgressText,
  setMlxLoadOverlayVisible,
  setPlannerThinking,
  appendMlxLoadProgress,
  formatAutoplaySessionStatusLine,
  refreshModeFromServer,
  initTextLlmPicker,
  onPlannerPromptSse: (d) => {
    promptLab.setLastSentFromSse(d);
  },
  typingTimingFromPaceSelect,
});

if (browserOrchestratedAutoplay) {
  const { wireBrowserAutoplayOrchestrator } =
    await import("./browserAutoplayOrchestrator.js");
  wireBrowserAutoplayOrchestrator(ports, api, es);
}

/* ——— DOM listeners (orchestration) ——— */

{
  const el = elements;
  if (el?.autoplayToggle) {
    el.autoplayToggle.addEventListener("change", async () => {
      clearManualError();
      try {
        const r = await api.postAutoplayMode(el.autoplayToggle.checked);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          showManualError(j.error || "Could not update autoplay mode.");
          await refreshModeFromServer();
          return;
        }
        if (typeof j.plannerEnabled === "boolean") {
          el.autoplayToggle.checked = j.plannerEnabled;
        }
        setManualUiState();
      } catch (e) {
        showManualError(e instanceof Error ? e.message : "Network error");
        await refreshModeFromServer();
      }
    });
  }
  if (el?.autoplayPaceMsEl) {
    el.autoplayPaceMsEl.addEventListener(
      "change",
      scheduleSaveAutoplaySettings,
    );
  }
  if (el?.autoplayMaxMovesEl) {
    el.autoplayMaxMovesEl.addEventListener(
      "input",
      scheduleSaveAutoplaySettings,
    );
  }
  if (el?.manualSend) {
    el.manualSend.addEventListener("click", () => {
      void submitManualCommand();
    });
  }
  if (el?.manualEndSession) {
    el.manualEndSession.addEventListener("click", () => {
      void postManualCommand({ endSession: true });
    });
  }
  if (el?.manualInput) {
    el.manualInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      if (el.manualSend && !el.manualSend.disabled) {
        void submitManualCommand();
      }
    });
  }
}

initTranscriptLayout();
wireTranscriptFeedScrollIntent();

if (elements?.transcriptLayoutToggle) {
  elements.transcriptLayoutToggle.addEventListener("change", () => {
    applyTranscriptLayout(
      elements.transcriptLayoutToggle.checked ? "terminal" : "classic",
    );
  });
}

if (elements?.textLlmSelect) {
  elements.textLlmSelect.addEventListener("change", async () => {
    clearManualError();
    const el = elements;
    if (!el?.textLlmSelect) return;
    const v = el.textLlmSelect.value;
    let parsed;
    try {
      parsed = JSON.parse(v);
    } catch {
      showManualError("Invalid selection");
      return;
    }
    if (
      typeof parsed.providerId !== "string" ||
      typeof parsed.modelId !== "string"
    ) {
      showManualError("Invalid selection");
      return;
    }
    el.textLlmSelect.disabled = true;
    const prevStatus = el.sessionStatusEl?.textContent ?? "";
    try {
      const r = await api.postTextLlm({
        providerId: parsed.providerId,
        modelId: parsed.modelId,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        showManualError(j.error || `Model swap failed (${r.status})`);
        el.textLlmSelect.value = state.lastTextLlmOptionValue;
        if (!state.mlxModelLoadingUi) setSessionStatus(prevStatus);
        return;
      }
      const next =
        typeof j.providerId === "string" && typeof j.modelId === "string"
          ? JSON.stringify({ providerId: j.providerId, modelId: j.modelId })
          : v;
      if (next && [...el.textLlmSelect.options].some((o) => o.value === next)) {
        el.textLlmSelect.value = next;
      }
      state.lastTextLlmOptionValue = el.textLlmSelect.value;
      if (!state.mlxModelLoadingUi) setSessionStatus(prevStatus);
      void promptLab.refreshLlmGenFields();
    } catch (e) {
      showManualError(e instanceof Error ? e.message : "Network error");
      el.textLlmSelect.value = state.lastTextLlmOptionValue;
      if (!state.mlxModelLoadingUi) setSessionStatus(prevStatus);
    } finally {
      el.textLlmSelect.disabled = false;
    }
  });
}

void initTextLlmPicker();

if (elements?.mapZInput) {
  elements.mapZInput.addEventListener("change", () => {
    const last = window.__lastMapSnap;
    const el = elements;
    if (last && el?.mapZInput) {
      renderMapSlice(last, Number(el.mapZInput.value) || 0);
    }
  });
}

if (elements?.mlxLoadCancelBtn) {
  elements.mlxLoadCancelBtn.addEventListener("click", async () => {
    clearManualError();
    const btn = elements.mlxLoadCancelBtn;
    if (!btn) return;
    btn.disabled = true;
    try {
      const r = await api.postMlxModelCancel();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        showManualError(j.error || `Cancel failed (${r.status})`);
      }
    } catch (e) {
      showManualError(e instanceof Error ? e.message : "Network error");
    } finally {
      if (elements?.mlxLoadCancelBtn)
        elements.mlxLoadCancelBtn.disabled = false;
    }
  });
}

wireCopyPromptButtonsFromElements();
wireMapScrollAndResize();
wireDashboardHelpDialogs();
wireMermaidFullscreenDialog();
wireMapVisualTabs();

async function refreshBenchmarkLeaderboard() {
  const el = elements;
  const pre = el?.benchmarkLeaderboardPreEl;
  if (!pre) return;
  pre.textContent = "Loading…";
  try {
    const r = await fetch(
      "/api/benchmark-runs/leaderboard?limit=20&sort=cellsDiscovered",
      { credentials: "same-origin" },
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pre.textContent =
        typeof j.error === "string"
          ? j.error
          : `Leaderboard unavailable (${r.status})`;
      return;
    }
    const runs = Array.isArray(j.runs) ? j.runs : [];
    if (runs.length === 0) {
      pre.textContent =
        "No runs yet. Complete an autoplay session with benchmark DB enabled.";
      return;
    }
    const lines = runs.map(
      (row) =>
        `${row.created_at}  cells=${row.cellsDiscovered}  moves=${row.moves}  wallMs=${row.wallTimeMs}  plannerMs=${row.plannerMsTotal}  status=${row.status}${row.team_name ? `  team=${row.team_name}` : ""}`,
    );
    pre.textContent = lines.join("\n");
  } catch (e) {
    pre.textContent = e instanceof Error ? e.message : "Network error";
  }
}

if (elements?.benchmarkLeaderboardRefreshBtn) {
  elements.benchmarkLeaderboardRefreshBtn.addEventListener("click", () => {
    void refreshBenchmarkLeaderboard();
  });
}
