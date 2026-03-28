/**
 * Autoplay dashboard: EventSource consumer for /events.
 */

import {
  blockBodyChronological,
  sortTranscriptBlocksChronological,
} from "./transcriptLayoutLogic.js";
import { preloadTerminalSounds, typeTextIntoPre } from "./terminalTyper.js";

const transcriptEl = document.getElementById("transcript");
const autoplayLogEl = document.getElementById("autoplay-log");
const sessionStatusEl = document.getElementById("session-status");
const spinnerEl = document.getElementById("planner-spinner");
const lastPlanEl = document.getElementById("last-plan");
const locationHintEl = document.getElementById("location-hint");
const inventoryEl = document.getElementById("inventory");
const stagnationEl = document.getElementById("stagnation");
const tryNextEl = document.getElementById("try-next");
const mapGridEl = document.getElementById("map-grid");
const mapCoordsEl = document.getElementById("map-coords");
const mapRoomKindEl = document.getElementById("map-room-kind");
const mapLegendEl = document.getElementById("map-legend");
const mapZInput = document.getElementById("map-z");
const mapMermaidEl = document.getElementById("map-mermaid");
const mapViewportEl = document.querySelector(".map-viewport");
const mapMermaidSrcEl = document.getElementById("map-mermaid-src");
const mapDotSrcEl = document.getElementById("map-dot-src");
const mapNullKeysEl = document.getElementById("map-null-keys");
const copyMermaidBtn = document.getElementById("copy-mermaid");
const copyDotBtn = document.getElementById("copy-dot");
const mermaidFullscreenDialog = document.getElementById(
  "mermaid-fullscreen-dialog",
);
const mermaidFullscreenBody = document.getElementById(
  "mermaid-fullscreen-body",
);
const mermaidFullscreenOpenBtn = document.getElementById(
  "mermaid-fullscreen-open",
);
const mermaidFullscreenCloseBtn = document.getElementById(
  "mermaid-fullscreen-close",
);

let mapMermaidRenderGeneration = 0;

/** @type {Record<string, string>} */
const ROOM_KIND_LABELS = {
  road: "Road",
  building: "Building",
  forest: "Forest",
  valley: "Valley",
  cave: "Cave",
  maze: "Maze",
  grate: "Grate",
  hall: "Hall",
  water: "Water",
  other: "Other",
};
const promptUserEl = document.getElementById("prompt-user");
const promptSystemEl = document.getElementById("prompt-system");
const promptSystemWrap = document.getElementById("prompt-system-wrap");
const copyPromptUserBtn = document.getElementById("copy-prompt-user");
const copyPromptSystemBtn = document.getElementById("copy-prompt-system");
const parserVerbHintsEl = document.getElementById("parser-verb-hints");
const autoplayToggle = document.getElementById("autoplay-toggle");
const autoplayPaceMsEl = document.getElementById("autoplay-pace-ms");
const autoplayMaxMovesEl = document.getElementById("autoplay-max-moves");
const manualBanner = document.getElementById("manual-banner");
const manualInput = document.getElementById("manual-input");
const manualInterpretToggle = document.getElementById(
  "manual-interpret-toggle",
);
const manualSend = document.getElementById("manual-send");
const manualEndSession = document.getElementById("manual-end-session");
const manualError = document.getElementById("manual-error");
const transcriptLayoutToggle = document.getElementById(
  "transcript-layout-toggle",
);
const manualControlsGroup = document.getElementById("manual-controls-group");
const manualControlsSlotFooter = document.getElementById(
  "manual-controls-slot-footer",
);
const manualControlsSlotCrt = document.getElementById(
  "manual-controls-slot-crt",
);
const transcriptPanelHintRow = document.querySelector(
  ".panel-hint-row--transcript",
);
const transcriptToolbarClassic = document.getElementById(
  "transcript-toolbar-classic",
);
const crtBezelSlot = document.getElementById("crt-bezel-slot");
const footerDashboardChunks = document.getElementById(
  "footer-dashboard-chunks",
);
const manualInterpretContainer = document.getElementById(
  "manual-interpret-container",
);
const footerControls = document.querySelector(".footer-controls");
const textLlmWrap = document.getElementById("text-llm-wrap");
const textLlmSelect = document.getElementById("text-llm-select");
const mlxLoadOverlay = document.getElementById("mlx-load-overlay");
const mlxLoadTitleEl = document.getElementById("mlx-load-title");
const mlxLoadProgressEl = document.getElementById("mlx-load-progress");
const mlxLoadCancelBtn = document.getElementById("mlx-load-cancel");

const MLX_LOAD_PROGRESS_MAX = 120000;

/** Last confirmed text LLM option value JSON (revert select on failed swap). */
let lastTextLlmOptionValue = "";

/** True while server reports MLX weights loading (do not let planner_phase clear the spinner). */
let mlxModelLoadingUi = false;

/** Footer text before MLX load banner (restored when load finishes). */
let sessionStatusBeforeMlxLoad = "";

function clearMlxLoadProgressText() {
  if (mlxLoadProgressEl) mlxLoadProgressEl.textContent = "";
}

/**
 * @param {string} chunk
 */
function appendMlxLoadProgress(chunk) {
  if (!mlxLoadProgressEl || typeof chunk !== "string" || chunk === "") return;
  let next = mlxLoadProgressEl.textContent + chunk;
  if (next.length > MLX_LOAD_PROGRESS_MAX) {
    next = `…(truncated)\n${next.slice(-(MLX_LOAD_PROGRESS_MAX - 32))}`;
  }
  mlxLoadProgressEl.textContent = next;
  mlxLoadProgressEl.scrollTop = mlxLoadProgressEl.scrollHeight;
}

/**
 * @param {boolean} show
 */
function setMlxLoadOverlayVisible(show) {
  if (!mlxLoadOverlay) return;
  mlxLoadOverlay.classList.toggle("hidden", !show);
  mlxLoadOverlay.setAttribute("aria-hidden", show ? "false" : "true");
  document.body.classList.toggle("mlx-loading", show);
}

/**
 * Newest block first. Game output only; index 0 of `parts` is the newest chunk.
 * @type {{ step: number; parts: string[] }[]}
 */
let transcriptBlocks = [];

/**
 * Terminal layout: local echo lines shown after server text for `afterStep`, in send order.
 * @type {{ afterStep: number; line: string; seq: number; animate?: boolean }[]}
 */
let terminalEchoQueue = [];

/** Monotonic sequence for stable echo ordering. */
let terminalEchoSeq = 0;

/** seq → full line to type (including `> ` and newline); cleared after animation. */
const pendingEchoTypeTextBySeq = new Map();

/** GETIN line for transcript step (from plan_applied), for block headers. */
/** @type {Record<number, string>} */
const getinLineByStep = {};

/** Wrapper inferred-grid hint from server (e.g. map Δz-1); keyed by moveNumber. */
/** @type {Record<number, string | null>} */
const motionGridHintByStep = {};

/** @type {boolean} */
let waitingForManual = false;

const TRANSCRIPT_LAYOUT_KEY = "adventureTranscriptLayout";
const TRANSCRIPT_SCROLL_BOTTOM_EPS_PX = 48;

function isTerminalTranscriptLayout() {
  return document.body.classList.contains("transcript-layout--terminal");
}

/**
 * @param {"classic" | "terminal"} mode
 */
function applyTranscriptLayout(mode) {
  const isTerminal = mode === "terminal";
  const wasTerminal = isTerminalTranscriptLayout();
  document.body.classList.toggle("transcript-layout--terminal", isTerminal);
  try {
    localStorage.setItem(TRANSCRIPT_LAYOUT_KEY, mode);
  } catch {
    /* ignore */
  }
  if (transcriptLayoutToggle) {
    transcriptLayoutToggle.checked = isTerminal;
  }

  const canRelocateBezel =
    crtBezelSlot &&
    transcriptToolbarClassic &&
    footerDashboardChunks &&
    transcriptPanelHintRow &&
    footerControls &&
    manualControlsSlotFooter;

  if (canRelocateBezel) {
    if (isTerminal) {
      crtBezelSlot.hidden = false;
      crtBezelSlot.setAttribute("aria-hidden", "false");
      crtBezelSlot.appendChild(transcriptToolbarClassic);
      crtBezelSlot.appendChild(footerDashboardChunks);
      if (manualInterpretContainer) {
        crtBezelSlot.appendChild(manualInterpretContainer);
      }
    } else {
      crtBezelSlot.hidden = true;
      crtBezelSlot.setAttribute("aria-hidden", "true");
      transcriptPanelHintRow.appendChild(transcriptToolbarClassic);
      footerControls.insertBefore(
        footerDashboardChunks,
        manualControlsSlotFooter,
      );
      if (manualControlsGroup && manualInterpretContainer) {
        manualControlsGroup.insertBefore(
          manualInterpretContainer,
          manualControlsGroup.firstChild,
        );
      }
    }
  }

  if (
    manualControlsGroup &&
    manualControlsSlotFooter &&
    manualControlsSlotCrt
  ) {
    (isTerminal ? manualControlsSlotCrt : manualControlsSlotFooter).appendChild(
      manualControlsGroup,
    );
  }
  renderTranscriptFeed();
  if (isTerminal && !wasTerminal && manualInput && !manualInput.disabled) {
    preloadTerminalSounds();
    manualInput.focus();
  }
}

function initTranscriptLayout() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("transcript");
  let mode = "classic";
  if (q === "terminal" || q === "classic") {
    mode = q;
  } else {
    try {
      const s = localStorage.getItem(TRANSCRIPT_LAYOUT_KEY);
      if (s === "terminal" || s === "classic") {
        mode = s;
      }
    } catch {
      /* ignore */
    }
  }
  applyTranscriptLayout(mode);
}

function stepCaption(step) {
  if (step === 0) return "Step 0 · opening (no GETIN yet)";
  const cmd = getinLineByStep[step];
  const hint = motionGridHintByStep[step];
  const hintSuffix =
    typeof hint === "string" && hint.length > 0 ? ` · ${hint}` : "";
  if (cmd) return `Step ${step} · ${cmd}${hintSuffix}`;
  return `Step ${step} · (GETIN pending or unknown)${hintSuffix}`;
}

function blockBodyText(b) {
  return b.parts.join("");
}

function maxTranscriptStep() {
  if (transcriptBlocks.length === 0) return 0;
  return Math.max(...transcriptBlocks.map((b) => b.step), 0);
}

/**
 * @param {string} line raw command (trimmed)
 * @param {{ animate?: boolean }} [options]
 */
function appendTerminalCommandEcho(line, options = {}) {
  if (!isTerminalTranscriptLayout() || !line) return;
  terminalEchoSeq += 1;
  const seq = terminalEchoSeq;
  const displayText = `> ${line.toUpperCase()}\n`;
  if (options.animate) {
    pendingEchoTypeTextBySeq.set(seq, displayText);
  }
  terminalEchoQueue.push({
    afterStep: maxTranscriptStep(),
    line,
    seq,
    animate: Boolean(options.animate),
  });
}

/**
 * @param {DocumentFragment} frag
 * @param {{ line: string; seq: number; animate?: boolean }} e
 */
function appendTerminalEchoPre(frag, e) {
  const wrap = document.createElement("div");
  wrap.className =
    "transcript-block transcript-block--terminal transcript-block--echo";
  const pre = document.createElement("pre");
  pre.className = "transcript-body transcript-terminal-echo-line";
  if (e.animate && pendingEchoTypeTextBySeq.has(e.seq)) {
    pre.dataset.terminalEchoAnimate = String(e.seq);
    pre.textContent = "";
  } else {
    pre.textContent = `> ${e.line.toUpperCase()}\n`;
  }
  wrap.appendChild(pre);
  frag.appendChild(wrap);
}

/**
 * Type pending echo lines (Unknown-style) after DOM mount.
 */
async function runPendingTerminalEchoAnimations() {
  if (!transcriptEl) return;
  const pres = transcriptEl.querySelectorAll("pre[data-terminal-echo-animate]");
  for (const pre of pres) {
    const seqStr = pre.getAttribute("data-terminal-echo-animate");
    pre.removeAttribute("data-terminal-echo-animate");
    const seq = Number(seqStr);
    const full = pendingEchoTypeTextBySeq.get(seq);
    pendingEchoTypeTextBySeq.delete(seq);
    const entry = terminalEchoQueue.find((x) => x.seq === seq);
    if (entry) {
      entry.animate = false;
    }
    if (typeof full === "string" && full.length > 0) {
      await typeTextIntoPre(
        transcriptEl,
        /** @type {HTMLPreElement} */ (pre),
        full,
        { charDelayMs: 26, finalPauseMs: 240 },
      );
    }
  }
}

function renderTranscriptFeed() {
  if (!transcriptEl) return;
  const terminal = isTerminalTranscriptLayout();
  const prevScrollTop = transcriptEl.scrollTop;
  const prevScrollHeight = transcriptEl.scrollHeight;
  const wasAtBottom =
    prevScrollHeight - prevScrollTop - transcriptEl.clientHeight <=
    TRANSCRIPT_SCROLL_BOTTOM_EPS_PX;

  transcriptEl.replaceChildren();
  const frag = document.createDocumentFragment();
  if (terminal) {
    const sorted = sortTranscriptBlocksChronological(transcriptBlocks);
    const echoes = [...terminalEchoQueue].sort((a, b) => a.seq - b.seq);
    /** @type {Map<number, { line: string; seq: number; animate?: boolean }[]>} */
    const echoesByStep = new Map();
    for (const e of echoes) {
      const list = echoesByStep.get(e.afterStep) ?? [];
      list.push(e);
      echoesByStep.set(e.afterStep, list);
    }
    const renderedSteps = new Set();
    for (const b of sorted) {
      const wrap = document.createElement("div");
      wrap.className = "transcript-block transcript-block--terminal";
      const pre = document.createElement("pre");
      pre.className = "transcript-body transcript-terminal-game";
      pre.textContent = blockBodyChronological(b);
      wrap.appendChild(pre);
      frag.appendChild(wrap);
      renderedSteps.add(b.step);
      const forStep = echoesByStep.get(b.step);
      if (forStep) {
        for (const echoEntry of forStep) {
          appendTerminalEchoPre(frag, echoEntry);
        }
      }
    }
    for (const e of echoes) {
      if (!renderedSteps.has(e.afterStep)) {
        appendTerminalEchoPre(frag, e);
      }
    }
  } else {
    for (const b of transcriptBlocks) {
      const wrap = document.createElement("div");
      wrap.className = "transcript-block";
      const cap = document.createElement("div");
      cap.className = "transcript-step";
      cap.textContent = stepCaption(b.step);
      const pre = document.createElement("pre");
      pre.className = "transcript-body";
      pre.textContent = blockBodyText(b);
      wrap.appendChild(cap);
      wrap.appendChild(pre);
      frag.appendChild(wrap);
    }
  }
  transcriptEl.appendChild(frag);

  requestAnimationFrame(() => {
    if (!transcriptEl) return;
    if (terminal) {
      if (wasAtBottom || prevScrollHeight === 0) {
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
      } else {
        const delta = transcriptEl.scrollHeight - prevScrollHeight;
        transcriptEl.scrollTop = prevScrollTop + delta;
      }
    } else {
      transcriptEl.scrollTop = 0;
    }
  });
}

/**
 * @param {string} line
 * @param {number} step
 */
function appendAutoplayLogLine(line, step) {
  if (!autoplayLogEl) return;
  const row = document.createElement("div");
  row.className = "autoplay-log-line";
  const cap = document.createElement("span");
  cap.className = "autoplay-log-step";
  cap.textContent =
    typeof step === "number" && Number.isFinite(step)
      ? `planner · step ${step} · `
      : "planner · ";
  const body = document.createElement("span");
  body.className = "autoplay-log-text";
  body.textContent = line.replace(/\n+$/g, "");
  row.appendChild(cap);
  row.appendChild(body);
  autoplayLogEl.insertBefore(row, autoplayLogEl.firstChild);
  autoplayLogEl.scrollTop = 0;
}

/**
 * @param {string} text
 * @param {number} step
 */
function addTranscriptChunk(text, step) {
  const s = typeof step === "number" && Number.isFinite(step) ? step : 0;
  const head = transcriptBlocks[0];
  if (head && head.step === s) {
    head.parts.unshift(text);
  } else {
    transcriptBlocks.unshift({
      step: s,
      parts: [text],
    });
  }
  renderTranscriptFeed();
}

function resetTranscriptFeed() {
  transcriptBlocks = [];
  terminalEchoQueue = [];
  terminalEchoSeq = 0;
  pendingEchoTypeTextBySeq.clear();
  for (const k of Object.keys(getinLineByStep)) {
    delete getinLineByStep[Number(k)];
  }
  for (const k of Object.keys(motionGridHintByStep)) {
    delete motionGridHintByStep[Number(k)];
  }
  if (autoplayLogEl) autoplayLogEl.replaceChildren();
  renderTranscriptFeed();
}

function setSessionStatus(text) {
  sessionStatusEl.textContent = text;
}

/**
 * Set on session_start so pace/max edits can refresh the footer without a new session.
 * @type {{ paceMs: number; maxMoves: number; providerId: string } | null}
 */
let activeSessionAutoplayMeta = null;

/**
 * @param {{ paceMs: number; maxMoves: number; providerId: string }} meta
 */
function formatAutoplaySessionStatusLine(meta) {
  return `Autoplay: pace ${meta.paceMs}ms, max moves ${meta.maxMoves}, provider ${meta.providerId}`;
}

/**
 * @param {number} paceMs
 * @param {number} maxMoves
 */
function applyLiveAutoplaySessionStatusFromPaceAndMax(paceMs, maxMoves) {
  if (!activeSessionAutoplayMeta) return;
  activeSessionAutoplayMeta = {
    ...activeSessionAutoplayMeta,
    paceMs,
    maxMoves,
  };
  const line = formatAutoplaySessionStatusLine(activeSessionAutoplayMeta);
  if (mlxModelLoadingUi) {
    if (sessionStatusBeforeMlxLoad) sessionStatusBeforeMlxLoad = line;
  } else {
    setSessionStatus(line);
  }
}

function setPlannerThinking(on) {
  spinnerEl.classList.toggle("hidden", !on);
}

function clearManualError() {
  manualError.textContent = "";
}

function showManualError(msg) {
  manualError.textContent = msg;
}

function setManualUiState() {
  const plannerOn = autoplayToggle.checked;
  manualBanner.classList.toggle("hidden", !waitingForManual || plannerOn);
  /**
   * When LLM autoplay is off, the runner will block on waitForManualLine on the next
   * move — but that can lag behind the toggle (pace delay, in-flight planner call).
   * Enable the field whenever autoplay is off; the server returns 409 until ready.
   */
  const canSend = !plannerOn;
  manualInput.disabled = !canSend;
  manualInterpretToggle.disabled = !canSend;
  manualSend.disabled = !canSend;
  manualEndSession.disabled = !canSend;
}

async function refreshModeFromServer() {
  try {
    const r = await fetch("/api/autoplay-mode");
    if (!r.ok) return;
    const j = await r.json();
    if (typeof j.plannerEnabled === "boolean") {
      autoplayToggle.checked = j.plannerEnabled;
    }
    if (typeof j.waitingForManual === "boolean") {
      waitingForManual = j.waitingForManual;
    }
    setManualUiState();
  } catch {
    /* ignore */
  }
}

autoplayToggle.addEventListener("change", async () => {
  clearManualError();
  try {
    const r = await fetch("/api/autoplay-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannerEnabled: autoplayToggle.checked }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      showManualError(j.error || "Could not update autoplay mode.");
      await refreshModeFromServer();
      return;
    }
    if (typeof j.plannerEnabled === "boolean") {
      autoplayToggle.checked = j.plannerEnabled;
    }
    setManualUiState();
  } catch (e) {
    showManualError(e instanceof Error ? e.message : "Network error");
    await refreshModeFromServer();
  }
});

const AUTOPLAY_SETTINGS_DEBOUNCE_MS = 400;
/** @type {ReturnType<typeof setTimeout> | null} */
let autoplaySettingsSaveTimer = null;

function scheduleSaveAutoplaySettings() {
  if (autoplaySettingsSaveTimer) clearTimeout(autoplaySettingsSaveTimer);
  autoplaySettingsSaveTimer = setTimeout(() => {
    autoplaySettingsSaveTimer = null;
    void saveAutoplaySettingsNow();
  }, AUTOPLAY_SETTINGS_DEBOUNCE_MS);
}

async function saveAutoplaySettingsNow() {
  clearManualError();
  try {
    const paceMs = Number(autoplayPaceMsEl?.value);
    const maxMoves = Number(autoplayMaxMovesEl?.value);
    const r = await fetch("/api/autoplay-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paceMs: Number.isFinite(paceMs) ? paceMs : undefined,
        maxMoves: Number.isFinite(maxMoves) ? maxMoves : undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      showManualError(j.error || "Could not save pace/max.");
      return;
    }
    localStorage.setItem(
      "adventureAutoplaySettings",
      JSON.stringify({ paceMs: j.paceMs, maxMoves: j.maxMoves }),
    );
    if (autoplayPaceMsEl) autoplayPaceMsEl.value = String(j.paceMs);
    if (autoplayMaxMovesEl) autoplayMaxMovesEl.value = String(j.maxMoves);
    if (typeof j.paceMs === "number" && typeof j.maxMoves === "number") {
      applyLiveAutoplaySessionStatusFromPaceAndMax(j.paceMs, j.maxMoves);
    }
  } catch (e) {
    showManualError(e instanceof Error ? e.message : "Network error");
  }
}

if (autoplayPaceMsEl) {
  autoplayPaceMsEl.addEventListener("input", scheduleSaveAutoplaySettings);
}
if (autoplayMaxMovesEl) {
  autoplayMaxMovesEl.addEventListener("input", scheduleSaveAutoplaySettings);
}

/**
 * @param {Record<string, unknown>} body
 */
async function postManualCommand(body) {
  clearManualError();
  try {
    const r = await fetch("/api/manual-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const raw = typeof j.error === "string" ? j.error : "";
      if (r.status === 409 && /not waiting for a manual command/i.test(raw)) {
        showManualError(
          "Session is not ready for input yet (finishing the previous step or pace delay). Try again in a moment.",
        );
      } else {
        showManualError(raw || `Request failed (${r.status})`);
      }
      return;
    }
    manualInput.value = "";
  } catch (e) {
    showManualError(e instanceof Error ? e.message : "Network error");
  }
}

async function submitManualCommand() {
  const line = manualInput.value.trim();
  if (!line) {
    showManualError(
      manualInterpretToggle.checked
        ? "Enter text for the interpreter to map to parser tokens."
        : "Enter a parser command (e.g. EAST).",
    );
    return;
  }
  if (isTerminalTranscriptLayout()) {
    preloadTerminalSounds();
    manualInput.value = "";
    appendTerminalCommandEcho(line, { animate: true });
    renderTranscriptFeed();
    await runPendingTerminalEchoAnimations();
  }
  if (manualInterpretToggle.checked) {
    await postManualCommand({ natural: line });
  } else {
    await postManualCommand({ getinLine: line });
  }
}

manualSend.addEventListener("click", () => {
  void submitManualCommand();
});

manualEndSession.addEventListener("click", () => {
  postManualCommand({ endSession: true });
});

manualInput.addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter") return;
  ev.preventDefault();
  if (!manualSend.disabled) {
    void submitManualCommand();
  }
});

initTranscriptLayout();

if (transcriptLayoutToggle) {
  transcriptLayoutToggle.addEventListener("change", () => {
    applyTranscriptLayout(
      transcriptLayoutToggle.checked ? "terminal" : "classic",
    );
  });
}

void refreshModeFromServer();

const TEXT_LLM_OPTGROUP_LABELS = {
  mlx: "Local (MLX)",
  http: "HTTP (OpenAI-compatible)",
  google: "Google (Gemini)",
};

/**
 * Populate text LLM dropdown from server (MLX / HTTP / Gemini when configured).
 */
async function initTextLlmPicker() {
  if (!textLlmWrap || !textLlmSelect) return;
  try {
    const r = await fetch("/api/text-llm");
    if (!r.ok) return;
    const j = await r.json();
    if (!j.canSwap || !Array.isArray(j.backends)) {
      textLlmWrap.classList.add("hidden");
      textLlmWrap.setAttribute("aria-hidden", "true");
      return;
    }
    const hasAny = j.backends.some((b) => b.available && b.presets.length > 0);
    if (!hasAny) {
      textLlmWrap.classList.add("hidden");
      textLlmWrap.setAttribute("aria-hidden", "true");
      return;
    }
    textLlmWrap.classList.remove("hidden");
    textLlmWrap.setAttribute("aria-hidden", "false");
    textLlmSelect.replaceChildren();
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
      textLlmSelect.appendChild(og);
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
      if ([...textLlmSelect.options].some((o) => o.value === want)) {
        textLlmSelect.value = want;
      }
    }
    lastTextLlmOptionValue = textLlmSelect.value;
  } catch {
    /* ignore */
  }
}

if (textLlmSelect) {
  textLlmSelect.addEventListener("change", async () => {
    clearManualError();
    const v = textLlmSelect.value;
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
    textLlmSelect.disabled = true;
    const prevStatus = sessionStatusEl.textContent;
    try {
      const r = await fetch("/api/text-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: parsed.providerId,
          modelId: parsed.modelId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        showManualError(j.error || `Model swap failed (${r.status})`);
        textLlmSelect.value = lastTextLlmOptionValue;
        if (!mlxModelLoadingUi) setSessionStatus(prevStatus);
        return;
      }
      const next =
        typeof j.providerId === "string" && typeof j.modelId === "string"
          ? JSON.stringify({ providerId: j.providerId, modelId: j.modelId })
          : v;
      if (next && [...textLlmSelect.options].some((o) => o.value === next)) {
        textLlmSelect.value = next;
      }
      lastTextLlmOptionValue = textLlmSelect.value;
      if (!mlxModelLoadingUi) setSessionStatus(prevStatus);
    } catch (e) {
      showManualError(e instanceof Error ? e.message : "Network error");
      textLlmSelect.value = lastTextLlmOptionValue;
      if (!mlxModelLoadingUi) setSessionStatus(prevStatus);
    } finally {
      textLlmSelect.disabled = false;
    }
  });
}

void initTextLlmPicker();

/**
 * @param {unknown} data
 * @returns {any}
 */
function parseData(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * @param {object} mapSnap
 * @param {number} sliceZ
 */
/**
 * @param {string} src
 * @param {HTMLElement | null} container
 */
/**
 * Mermaid returns an error diagram (not a throw) when the source fails to parse.
 * @param {string} svgHtml
 */
function isMermaidParseErrorSvg(svgHtml) {
  return (
    typeof svgHtml === "string" &&
    (svgHtml.includes('aria-roledescription="error"') ||
      svgHtml.includes("Syntax error in text"))
  );
}

async function renderMermaidInto(src, container) {
  if (!container || typeof src !== "string" || src.trim() === "") {
    if (container) container.textContent = "";
    return;
  }
  const gen = ++mapMermaidRenderGeneration;
  try {
    const mod =
      await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
    const mer = mod.default;
    mer.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "dark",
    });
    const id = "mermap_" + Date.now().toString(36);
    const { svg } = await mer.render(id, src);
    if (gen !== mapMermaidRenderGeneration) return;
    container.innerHTML = "";
    if (isMermaidParseErrorSvg(svg)) {
      container.textContent =
        "(Could not render diagram in-browser. Use Copy Mermaid or open the source below.)";
      return;
    }
    container.insertAdjacentHTML("beforeend", svg);
  } catch {
    if (gen !== mapMermaidRenderGeneration) return;
    container.textContent =
      "(Could not render diagram in-browser. Use Copy Mermaid or open the source below.)";
  }
}

/**
 * @param {object} snapshot
 */
function applyFsmPanel(snapshot) {
  const mm = typeof snapshot.mapMermaid === "string" ? snapshot.mapMermaid : "";
  const dot = typeof snapshot.mapDot === "string" ? snapshot.mapDot : "";
  if (mapMermaidSrcEl) mapMermaidSrcEl.textContent = mm;
  if (mapDotSrcEl) mapDotSrcEl.textContent = dot;
  const nulls = snapshot.nullCommandKeysAtCurrentNode;
  if (mapNullKeysEl) {
    if (Array.isArray(nulls) && nulls.length > 0) {
      mapNullKeysEl.textContent =
        "NULL / exclude at current node (no fp+inv change): " +
        nulls.join(" · ");
    } else {
      mapNullKeysEl.textContent = "";
    }
  }
  void renderMermaidInto(mm, mapMermaidEl).finally(() => {
    updateMapScrollCorners();
    syncMermaidFullscreenIfOpen();
  });
}

function renderMapSlice(mapSnap, sliceZ) {
  const cur = mapSnap.current;
  mapCoordsEl.textContent = `(${cur.x}, ${cur.y}, ${cur.z})`;

  const cells = (mapSnap.cells || []).filter((c) => c.z === sliceZ);
  if (cells.length === 0 && cur.z !== sliceZ) {
    if (mapGridEl) mapGridEl.replaceChildren();
    if (mapGridEl)
      mapGridEl.appendChild(
        document.createTextNode(
          `(no cells at z=${sliceZ}; player at z=${cur.z})`,
        ),
      );
    if (mapRoomKindEl) mapRoomKindEl.textContent = "";
    if (mapLegendEl) mapLegendEl.replaceChildren();
    updateMapScrollCorners();
    return;
  }
  let minX = cur.x;
  let maxX = cur.x;
  let minY = cur.y;
  let maxY = cur.y;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  if (cur.z === sliceZ) {
    minX = Math.min(minX, cur.x);
    maxX = Math.max(maxX, cur.x);
    minY = Math.min(minY, cur.y);
    maxY = Math.max(maxY, cur.y);
  }
  const pad = 1;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const byXY = new Map();
  for (const c of cells) {
    byXY.set(`${c.x},${c.y}`, c);
  }

  const here = byXY.get(`${cur.x},${cur.y}`);
  if (mapRoomKindEl) {
    if (cur.z === sliceZ && here && here.roomKind) {
      const kind = ROOM_KIND_LABELS[here.roomKind] || here.roomKind;
      const lab = (here.label || "").slice(0, 160);
      mapRoomKindEl.textContent = `${kind} — ${lab}${(here.label || "").length > 160 ? "…" : ""}`;
    } else if (cur.z === sliceZ) {
      mapRoomKindEl.textContent =
        "Current position: room type unknown (move to refresh fingerprint).";
    } else {
      mapRoomKindEl.textContent = "";
    }
  }

  const cols = maxX - minX + 1;
  const kindsForLegend = new Set();
  if (mapGridEl) {
    mapGridEl.replaceChildren();
    mapGridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(1.15rem, 1fr))`;
    for (let y = maxY; y >= minY; y--) {
      for (let x = minX; x <= maxX; x++) {
        const cell = byXY.get(`${x},${y}`);
        const isPlayer = cur.z === sliceZ && x === cur.x && y === cur.y;
        const span = document.createElement("span");
        span.className = "map-cell";
        if (isPlayer) {
          span.classList.add("map-cell--player");
          if (cell && cell.roomKind) {
            span.classList.add(`map-cell--kind-${cell.roomKind}`);
            kindsForLegend.add(cell.roomKind);
          }
          span.textContent = "@";
          span.title = cell
            ? `${ROOM_KIND_LABELS[cell.roomKind] || cell.roomKind} (${x},${y},${sliceZ})\n${cell.label || ""}`
            : `You (${x},${y},${sliceZ})`;
        } else if (cell) {
          const rk = cell.roomKind || "other";
          span.classList.add("map-cell--visited", `map-cell--kind-${rk}`);
          span.textContent = "·";
          span.title = `${ROOM_KIND_LABELS[rk] || rk} (${x},${y},${sliceZ})\n${cell.label || ""}`;
          kindsForLegend.add(rk);
        } else {
          span.classList.add("map-cell--unmapped");
          span.textContent = "·";
          span.title = `Not mapped (${x},${y},${sliceZ})`;
        }
        mapGridEl.appendChild(span);
      }
    }
  }

  if (mapLegendEl) {
    mapLegendEl.replaceChildren();
    const row = document.createElement("div");
    row.className = "map-legend-row";
    const intro = document.createElement("span");
    intro.className = "map-legend-intro muted";
    intro.textContent = "This layer · ";
    row.appendChild(intro);
    const sorted = [...kindsForLegend].sort((a, b) => a.localeCompare(b));
    for (const k of sorted) {
      const pair = document.createElement("span");
      pair.className = "map-legend-pair";
      const sw = document.createElement("span");
      sw.className = `map-legend-swatch map-cell--visited map-cell--kind-${k}`;
      sw.textContent = "·";
      sw.setAttribute("aria-hidden", "true");
      const lb = document.createElement("span");
      lb.className = "map-legend-text";
      lb.textContent = ROOM_KIND_LABELS[k] || k;
      pair.appendChild(sw);
      pair.appendChild(lb);
      row.appendChild(pair);
    }
    const padPair = document.createElement("span");
    padPair.className = "map-legend-pair";
    const swPad = document.createElement("span");
    swPad.className = "map-legend-swatch map-cell--unmapped";
    swPad.textContent = "·";
    const lbPad = document.createElement("span");
    lbPad.className = "map-legend-text muted";
    lbPad.textContent = "Padding";
    padPair.appendChild(swPad);
    padPair.appendChild(lbPad);
    row.appendChild(padPair);
    mapLegendEl.appendChild(row);
  }
  updateMapScrollCorners();
}

/**
 * @param {object} snapshot
 */
function applySnapshot(snapshot) {
  locationHintEl.textContent = snapshot.locationHint || "—";
  inventoryEl.replaceChildren();
  const inv = snapshot.inventory || [];
  if (inv.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(not detected)";
    li.className = "muted";
    inventoryEl.appendChild(li);
  } else {
    for (const item of inv) {
      const li = document.createElement("li");
      li.textContent = item;
      inventoryEl.appendChild(li);
    }
  }
  stagnationEl.textContent = snapshot.stagnating
    ? "Location appears stagnant (heuristic)."
    : "";
  tryNextEl.textContent = snapshot.tryNextLine || "";

  const z = Number(mapZInput.value);
  const sliceZ = Number.isFinite(z) ? z : snapshot.map.current.z;
  mapZInput.value = String(sliceZ);
  renderMapSlice(snapshot.map, sliceZ);
  applyFsmPanel(snapshot);
}

mapZInput.addEventListener("change", () => {
  const last = window.__lastMapSnap;
  if (last) renderMapSlice(last, Number(mapZInput.value) || 0);
});

async function applyStoredAutoplaySettings() {
  try {
    const r = await fetch("/api/autoplay-settings");
    const j = r.ok ? await r.json() : {};
    if (autoplayPaceMsEl && typeof j.paceMs === "number") {
      autoplayPaceMsEl.value = String(j.paceMs);
    }
    if (autoplayMaxMovesEl && typeof j.maxMoves === "number") {
      autoplayMaxMovesEl.value = String(j.maxMoves);
    }
    let fromStore = null;
    try {
      fromStore = JSON.parse(
        localStorage.getItem("adventureAutoplaySettings") || "null",
      );
    } catch {
      fromStore = null;
    }
    const body = {};
    if (fromStore && typeof fromStore.paceMs === "number") {
      body.paceMs = fromStore.paceMs;
    }
    if (fromStore && typeof fromStore.maxMoves === "number") {
      body.maxMoves = fromStore.maxMoves;
    }
    if (Object.keys(body).length > 0) {
      const pr = await fetch("/api/autoplay-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (pr.ok) {
        const j2 = await pr.json();
        if (autoplayPaceMsEl) autoplayPaceMsEl.value = String(j2.paceMs);
        if (autoplayMaxMovesEl) autoplayMaxMovesEl.value = String(j2.maxMoves);
      }
    }
  } catch {
    /* ignore */
  }
}

await applyStoredAutoplaySettings();

async function loadParserVerbHints() {
  if (!parserVerbHintsEl) return;
  try {
    const r = await fetch("/api/parser-verbs");
    const j = r.ok ? await r.json() : null;
    const groups =
      j && Array.isArray(j.groups) ? /** @type {string[][]} */ (j.groups) : [];
    parserVerbHintsEl.replaceChildren();
    if (!r.ok || groups.length === 0) {
      const p = document.createElement("p");
      p.className = "small muted";
      p.textContent = r.ok
        ? "No verb data."
        : "Verb list unavailable (is adventure.dat missing?)";
      parserVerbHintsEl.appendChild(p);
      return;
    }
    for (const tokens of groups) {
      if (!Array.isArray(tokens) || tokens.length === 0) continue;
      const line = document.createElement("p");
      line.className = "parser-verb-hint-line";
      line.textContent = tokens.join(" · ");
      parserVerbHintsEl.appendChild(line);
    }
  } catch {
    parserVerbHintsEl.replaceChildren();
    const p = document.createElement("p");
    p.className = "small muted";
    p.textContent = "Could not load verb hints.";
    parserVerbHintsEl.appendChild(p);
  }
}

await loadParserVerbHints();
const es = new EventSource("/events");

es.addEventListener("autoplay_mode", (ev) => {
  const d = parseData(ev.data);
  if (d && typeof d.plannerEnabled === "boolean") {
    autoplayToggle.checked = d.plannerEnabled;
    setManualUiState();
  }
});

es.addEventListener("autoplay_settings", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.paceMs !== "number" || typeof d.maxMoves !== "number")
    return;
  applyLiveAutoplaySessionStatusFromPaceAndMax(d.paceMs, d.maxMoves);
  const active = document.activeElement;
  if (active === autoplayPaceMsEl || active === autoplayMaxMovesEl) return;
  if (autoplayPaceMsEl) autoplayPaceMsEl.value = String(d.paceMs);
  if (autoplayMaxMovesEl) autoplayMaxMovesEl.value = String(d.maxMoves);
});

es.addEventListener("manual_waiting", (ev) => {
  const d = parseData(ev.data);
  if (d && typeof d.waitingForManual === "boolean") {
    waitingForManual = d.waitingForManual;
    clearManualError();
    setManualUiState();
  }
});

es.addEventListener("text_llm", (ev) => {
  const d = parseData(ev.data);
  if (
    !d ||
    typeof d.modelId !== "string" ||
    typeof d.providerId !== "string" ||
    !textLlmSelect
  )
    return;
  const want = JSON.stringify({
    providerId: d.providerId,
    modelId: d.modelId,
  });
  if ([...textLlmSelect.options].some((o) => o.value === want)) {
    textLlmSelect.value = want;
    lastTextLlmOptionValue = want;
  }
});

/** @deprecated Prefer text_llm; kept for older servers that only emit modelId. */
es.addEventListener("mlx_model", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.modelId !== "string" || !textLlmSelect) return;
  const matches = [...textLlmSelect.options].filter((o) => {
    try {
      const p = JSON.parse(o.value);
      return p.modelId === d.modelId;
    } catch {
      return false;
    }
  });
  if (matches.length === 1) {
    textLlmSelect.value = matches[0].value;
    lastTextLlmOptionValue = textLlmSelect.value;
  }
});

es.addEventListener("mlx_loading", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.loading !== "boolean") return;
  mlxModelLoadingUi = d.loading;
  if (d.loading) {
    sessionStatusBeforeMlxLoad = sessionStatusEl.textContent || "";
    const msg =
      typeof d.message === "string" && d.message.trim() !== ""
        ? d.message
        : "Loading MLX model…";
    setSessionStatus(msg);
    if (mlxLoadTitleEl) mlxLoadTitleEl.textContent = msg;
    if (d.resetProgress === true) clearMlxLoadProgressText();
    setMlxLoadOverlayVisible(true);
    setPlannerThinking(true);
    if (mlxLoadCancelBtn) {
      const showCancel = d.canCancel === true;
      mlxLoadCancelBtn.classList.toggle("hidden", !showCancel);
      mlxLoadCancelBtn.disabled = !showCancel;
    }
  } else {
    setPlannerThinking(false);
    setMlxLoadOverlayVisible(false);
    clearMlxLoadProgressText();
    if (mlxLoadCancelBtn) {
      mlxLoadCancelBtn.classList.add("hidden");
      mlxLoadCancelBtn.disabled = true;
    }
    if (sessionStatusBeforeMlxLoad) {
      setSessionStatus(sessionStatusBeforeMlxLoad);
      sessionStatusBeforeMlxLoad = "";
    }
  }
});

es.addEventListener("mlx_load_cancelled", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.modelId !== "string" || !textLlmSelect) return;
  const pid = typeof d.providerId === "string" ? d.providerId : "mlx";
  const want = JSON.stringify({ providerId: pid, modelId: d.modelId });
  if ([...textLlmSelect.options].some((o) => o.value === want)) {
    textLlmSelect.value = want;
    lastTextLlmOptionValue = want;
  }
});

if (mlxLoadCancelBtn) {
  mlxLoadCancelBtn.addEventListener("click", async () => {
    clearManualError();
    mlxLoadCancelBtn.disabled = true;
    try {
      const r = await fetch("/api/mlx-model/cancel", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        showManualError(j.error || `Cancel failed (${r.status})`);
      }
    } catch (e) {
      showManualError(e instanceof Error ? e.message : "Network error");
    } finally {
      if (mlxLoadCancelBtn) mlxLoadCancelBtn.disabled = false;
    }
  });
}

es.addEventListener("mlx_load_progress", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.chunk !== "string") return;
  appendMlxLoadProgress(d.chunk);
});

es.addEventListener("session_start", (ev) => {
  const d = parseData(ev.data);
  if (!d) return;
  resetTranscriptFeed();
  if (
    typeof d.paceMs === "number" &&
    typeof d.maxMoves === "number" &&
    typeof d.providerId === "string"
  ) {
    activeSessionAutoplayMeta = {
      paceMs: d.paceMs,
      maxMoves: d.maxMoves,
      providerId: d.providerId,
    };
    setSessionStatus(
      formatAutoplaySessionStatusLine(activeSessionAutoplayMeta),
    );
  } else {
    activeSessionAutoplayMeta = null;
    setSessionStatus(
      `Autoplay: pace ${d.paceMs}ms, max moves ${d.maxMoves}, provider ${d.providerId}`,
    );
  }
});

es.addEventListener("session_end", () => {
  activeSessionAutoplayMeta = null;
  setSessionStatus("Session ended.");
  setPlannerThinking(false);
});

es.addEventListener("session_error", (ev) => {
  activeSessionAutoplayMeta = null;
  const d = parseData(ev.data);
  if (d?.message) setSessionStatus(`Error: ${d.message}`);
  setPlannerThinking(false);
});

es.addEventListener("error", () => {
  if (es.readyState === EventSource.CLOSED) {
    activeSessionAutoplayMeta = null;
    setSessionStatus("Event stream closed.");
    setPlannerThinking(false);
  }
});

es.addEventListener("planner_phase", (ev) => {
  if (mlxModelLoadingUi) return;
  const d = parseData(ev.data);
  if (!d) return;
  setPlannerThinking(d.phase === "start");
});

es.addEventListener("planner_prompt", (ev) => {
  const d = parseData(ev.data);
  if (!d) return;
  promptUserEl.textContent = d.userPreview || "";
  if (d.systemPreview) {
    promptSystemEl.textContent = d.systemPreview;
    promptSystemWrap.classList.remove("hidden");
  } else {
    promptSystemEl.textContent = "";
    promptSystemWrap.classList.add("hidden");
  }
});

es.addEventListener("transcript_delta", (ev) => {
  const d = parseData(ev.data);
  if (!d || typeof d.text !== "string") return;
  const step = typeof d.step === "number" ? d.step : 0;
  addTranscriptChunk(d.text, step);
});

es.addEventListener("plan_applied", (ev) => {
  const d = parseData(ev.data);
  if (!d?.plan) return;
  const p = d.plan;
  const mn =
    typeof d.moveNumber === "number" && Number.isFinite(d.moveNumber)
      ? d.moveNumber
      : null;
  const getin = typeof d.getinLine === "string" ? d.getinLine.trimEnd() : "";
  const parts = [
    mn !== null ? `moveNumber: ${mn}` : null,
    `primaryToken: ${p.primaryToken}`,
    p.secondaryToken ? `secondaryToken: ${p.secondaryToken}` : null,
    p.confidence !== undefined ? `confidence: ${p.confidence}` : null,
    `continuePlaying: ${p.continuePlaying}`,
    "",
    getin ? `GETIN: ${getin}` : null,
  ].filter(Boolean);
  lastPlanEl.textContent = parts.join("\n");
  if (mn !== null) {
    if (getin) getinLineByStep[mn] = getin;
    motionGridHintByStep[mn] =
      typeof d.motionGridHint === "string" ? d.motionGridHint : null;
    renderTranscriptFeed();
  }
});

es.addEventListener("turn_end", (ev) => {
  const d = parseData(ev.data);
  if (!d?.snapshot) return;
  window.__lastMapSnap = d.snapshot.map;
  mapZInput.value = String(d.snapshot.map.current.z);
  applySnapshot(d.snapshot);
});

es.addEventListener("log_line", (ev) => {
  const d = parseData(ev.data);
  if (!d?.line) return;
  const step =
    typeof d.step === "number" && Number.isFinite(d.step) ? d.step : 0;
  appendAutoplayLogLine(d.line, step);
});

es.onopen = () => {
  setSessionStatus("Connected — autoplay starting…");
  void refreshModeFromServer();
  void initTextLlmPicker();
};

/**
 * @param {HTMLElement | null} btn
 * @param {HTMLElement | null} sourceEl
 */
function wireCopyPromptButton(btn, sourceEl) {
  if (!btn || !sourceEl) return;
  const defaultLabel = btn.textContent || "Copy";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = sourceEl.textContent ?? "";
    void navigator.clipboard.writeText(text).then(
      () => {
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = defaultLabel;
        }, 1200);
      },
      () => {
        btn.textContent = "Failed";
        setTimeout(() => {
          btn.textContent = defaultLabel;
        }, 1200);
      },
    );
  });
}

wireCopyPromptButton(copyPromptUserBtn, promptUserEl);
wireCopyPromptButton(copyPromptSystemBtn, promptSystemEl);
wireCopyPromptButton(copyMermaidBtn, mapMermaidSrcEl);
wireCopyPromptButton(copyDotBtn, mapDotSrcEl);

/**
 * Rounded bottom corners on scrollports only when scrolled to the end (or no overflow).
 * @param {HTMLElement | null} el
 * @param {string} endClass
 */
function updateScrollEndClass(el, endClass) {
  if (!el) return;
  const { scrollTop, scrollHeight, clientHeight } = el;
  const eps = 3;
  const atBottom = scrollTop + clientHeight >= scrollHeight - eps;
  const noOverflow = scrollHeight <= clientHeight + eps;
  el.classList.toggle(endClass, atBottom || noOverflow);
}

function updateMapScrollCorners() {
  updateScrollEndClass(mapViewportEl, "map-viewport--scroll-end");
  updateScrollEndClass(mapMermaidEl, "map-mermaid--scroll-end");
}

if (mapViewportEl) {
  mapViewportEl.addEventListener("scroll", updateMapScrollCorners, {
    passive: true,
  });
}
if (mapMermaidEl) {
  mapMermaidEl.addEventListener("scroll", updateMapScrollCorners, {
    passive: true,
  });
}
window.addEventListener("resize", updateMapScrollCorners, { passive: true });
const mapScrollResizeRo = new ResizeObserver(() => {
  requestAnimationFrame(updateMapScrollCorners);
});
if (mapViewportEl) mapScrollResizeRo.observe(mapViewportEl);
if (mapMermaidEl) mapScrollResizeRo.observe(mapMermaidEl);
updateMapScrollCorners();

function wireDashboardHelpDialogs() {
  const dialog = document.getElementById("dashboard-help-dialog");
  const titleEl = document.getElementById("dashboard-help-dialog-title");
  const bodyEl = document.getElementById("dashboard-help-dialog-body");
  const closeBtn = document.querySelector(".dashboard-help-dialog-close");
  if (!dialog || !titleEl || !bodyEl) return;

  document.querySelectorAll("[data-help-template]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const tid = btn.getAttribute("data-help-template");
      const tTitle = btn.getAttribute("data-help-title") || "Help";
      const tpl = tid ? document.getElementById(tid) : null;
      if (!tpl || tpl.tagName !== "TEMPLATE") return;
      titleEl.textContent = tTitle;
      bodyEl.replaceChildren();
      bodyEl.appendChild(tpl.content.cloneNode(true));
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    });
  });

  closeBtn?.addEventListener("click", () => {
    dialog.close();
  });
}

wireDashboardHelpDialogs();

function fillMermaidFullscreenFromSource() {
  if (!mermaidFullscreenBody || !mapMermaidEl) return;
  mermaidFullscreenBody.replaceChildren();
  const svg = mapMermaidEl.querySelector("svg");
  if (svg) {
    mermaidFullscreenBody.appendChild(svg.cloneNode(true));
    return;
  }
  const text = (mapMermaidEl.textContent || "").trim();
  const p = document.createElement("p");
  p.className = "mermaid-fullscreen-fallback";
  p.textContent = text || "(No diagram yet.)";
  mermaidFullscreenBody.appendChild(p);
}

function syncMermaidFullscreenIfOpen() {
  if (mermaidFullscreenDialog && mermaidFullscreenDialog.open) {
    fillMermaidFullscreenFromSource();
  }
}

function wireMermaidFullscreenDialog() {
  if (!mermaidFullscreenDialog || !mermaidFullscreenBody) return;
  mermaidFullscreenOpenBtn?.addEventListener("click", () => {
    fillMermaidFullscreenFromSource();
    if (typeof mermaidFullscreenDialog.showModal === "function") {
      mermaidFullscreenDialog.showModal();
    }
  });
  mermaidFullscreenCloseBtn?.addEventListener("click", () => {
    mermaidFullscreenDialog.close();
  });
  mermaidFullscreenDialog.addEventListener("click", (e) => {
    if (e.target === mermaidFullscreenDialog) {
      mermaidFullscreenDialog.close();
    }
  });
}

wireMermaidFullscreenDialog();
