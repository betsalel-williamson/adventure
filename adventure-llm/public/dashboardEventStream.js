import { elements } from "./dashboardElementRefs.js";
import { parseSseJson } from "./sseJson.js";
import { state } from "./dashboardState.js";
import { typeTextIntoInput, preloadTerminalSounds } from "./terminalTyper.js";
import {
  appendAutoplayLogLine,
  appendTerminalCommandEcho,
  bufferOrAddTranscriptChunk,
  clearAutoplayTranscriptHoldState,
  flushAutoplayHeldTranscript,
  isTerminalTranscriptLayout,
  maxTranscriptStep,
  renderTranscriptFeed,
  resetTranscriptFeed,
} from "./transcriptView.js";
import { applySnapshot } from "./mapView.js";

/**
 * App-supplied hooks for SSE handlers (everything not imported from sibling view modules).
 * @typedef {{
 *   renderParserVerbHintGroups: (groups: string[][], meta?: { datAvailable?: boolean }) => void;
 *   setManualUiState: () => void;
 *   applyLiveAutoplaySessionStatusFromPaceAndMax: (paceMs: number, maxMoves: number) => void;
 *   setAutoplayPaceSelectValue: (ms: number) => void;
 *   clearManualError: () => void;
 *   setSessionStatus: (text: string) => void;
 *   clearMlxLoadProgressText: () => void;
 *   setMlxLoadOverlayVisible: (show: boolean) => void;
 *   setPlannerThinking: (on: boolean) => void;
 *   appendMlxLoadProgress: (chunk: string) => void;
 *   formatAutoplaySessionStatusLine: (meta: {
 *     paceMs: number;
 *     maxMoves: number;
 *     providerId: string;
 *   }) => string;
 *   refreshModeFromServer: () => Promise<void>;
 *   initTextLlmPicker: () => Promise<void>;
 *   typingTimingFromPaceSelect: () => {
 *     charDelayMs: number;
 *     finalPauseMs: number;
 *   };
 * }} DashboardEventRegistry
 */

/**
 * @param {EventSource} es
 * @param {DashboardEventRegistry} reg
 */
export function registerDashboardEventHandlers(es, reg) {
  es.addEventListener("parser_verbs", (ev) => {
    const d = parseSseJson(ev.data);
    if (!d || !Array.isArray(d.groups)) return;
    const datOk = d.datAvailable !== false;
    reg.renderParserVerbHintGroups(/** @type {string[][]} */ (d.groups), {
      datAvailable: datOk,
    });
  });

  es.addEventListener("autoplay_mode", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (d && typeof d.plannerEnabled === "boolean" && el?.autoplayToggle) {
      el.autoplayToggle.checked = d.plannerEnabled;
      reg.setManualUiState();
    }
  });

  es.addEventListener("autoplay_settings", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d || typeof d.paceMs !== "number" || typeof d.maxMoves !== "number")
      return;
    reg.applyLiveAutoplaySessionStatusFromPaceAndMax(d.paceMs, d.maxMoves);
    const active = document.activeElement;
    if (active === el?.autoplayPaceMsEl || active === el?.autoplayMaxMovesEl)
      return;
    reg.setAutoplayPaceSelectValue(d.paceMs);
    if (el?.autoplayMaxMovesEl)
      el.autoplayMaxMovesEl.value = String(d.maxMoves);
  });

  es.addEventListener("manual_waiting", (ev) => {
    const d = parseSseJson(ev.data);
    if (d && typeof d.waitingForManual === "boolean") {
      state.waitingForManual = d.waitingForManual;
      reg.clearManualError();
      reg.setManualUiState();
    }
  });

  es.addEventListener("text_llm", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (
      !d ||
      typeof d.modelId !== "string" ||
      typeof d.providerId !== "string" ||
      !el?.textLlmSelect
    )
      return;
    const want = JSON.stringify({
      providerId: d.providerId,
      modelId: d.modelId,
    });
    if ([...el.textLlmSelect.options].some((o) => o.value === want)) {
      el.textLlmSelect.value = want;
      state.lastTextLlmOptionValue = want;
    }
  });

  /** @deprecated Prefer text_llm; kept for older servers that only emit modelId. */
  es.addEventListener("mlx_model", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d || typeof d.modelId !== "string" || !el?.textLlmSelect) return;
    const matches = [...el.textLlmSelect.options].filter((o) => {
      try {
        const p = JSON.parse(o.value);
        return p.modelId === d.modelId;
      } catch {
        return false;
      }
    });
    if (matches.length === 1) {
      el.textLlmSelect.value = matches[0].value;
      state.lastTextLlmOptionValue = el.textLlmSelect.value;
    }
  });

  es.addEventListener("mlx_loading", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d || typeof d.loading !== "boolean") return;
    state.mlxModelLoadingUi = d.loading;
    if (d.loading) {
      if (el?.sessionStatusEl) {
        state.sessionStatusBeforeMlxLoad = el.sessionStatusEl.textContent || "";
      } else {
        state.sessionStatusBeforeMlxLoad = "";
      }
      const msg =
        typeof d.message === "string" && d.message.trim() !== ""
          ? d.message
          : "Loading MLX model…";
      reg.setSessionStatus(msg);
      if (el?.mlxLoadTitleEl) el.mlxLoadTitleEl.textContent = msg;
      if (d.resetProgress === true) reg.clearMlxLoadProgressText();
      reg.setMlxLoadOverlayVisible(true);
      reg.setPlannerThinking(true);
      if (el?.mlxLoadCancelBtn) {
        const showCancel = d.canCancel === true;
        el.mlxLoadCancelBtn.classList.toggle("hidden", !showCancel);
        el.mlxLoadCancelBtn.disabled = !showCancel;
      }
    } else {
      reg.setPlannerThinking(false);
      reg.setMlxLoadOverlayVisible(false);
      reg.clearMlxLoadProgressText();
      if (el?.mlxLoadCancelBtn) {
        el.mlxLoadCancelBtn.classList.add("hidden");
        el.mlxLoadCancelBtn.disabled = true;
      }
      if (state.sessionStatusBeforeMlxLoad) {
        reg.setSessionStatus(state.sessionStatusBeforeMlxLoad);
        state.sessionStatusBeforeMlxLoad = "";
      }
    }
  });

  es.addEventListener("mlx_load_cancelled", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d || typeof d.modelId !== "string" || !el?.textLlmSelect) return;
    const pid = typeof d.providerId === "string" ? d.providerId : "mlx";
    const want = JSON.stringify({ providerId: pid, modelId: d.modelId });
    if ([...el.textLlmSelect.options].some((o) => o.value === want)) {
      el.textLlmSelect.value = want;
      state.lastTextLlmOptionValue = want;
    }
  });

  es.addEventListener("mlx_load_progress", (ev) => {
    const d = parseSseJson(ev.data);
    if (!d || typeof d.chunk !== "string") return;
    reg.appendMlxLoadProgress(d.chunk);
  });

  es.addEventListener("session_start", (ev) => {
    const d = parseSseJson(ev.data);
    if (!d) return;
    resetTranscriptFeed();
    if (
      typeof d.paceMs === "number" &&
      typeof d.maxMoves === "number" &&
      typeof d.providerId === "string"
    ) {
      state.activeSessionAutoplayMeta = {
        paceMs: d.paceMs,
        maxMoves: d.maxMoves,
        providerId: d.providerId,
      };
      reg.setSessionStatus(
        reg.formatAutoplaySessionStatusLine(state.activeSessionAutoplayMeta),
      );
    } else {
      state.activeSessionAutoplayMeta = null;
      reg.setSessionStatus(
        `Autoplay: pace ${d.paceMs}ms, max moves ${d.maxMoves}, provider ${d.providerId}`,
      );
    }
  });

  es.addEventListener("session_end", () => {
    state.activeSessionAutoplayMeta = null;
    state.autoplayTerminalPromptChain = Promise.resolve();
    clearAutoplayTranscriptHoldState();
    reg.setSessionStatus("Session ended.");
    reg.setPlannerThinking(false);
  });

  es.addEventListener("session_error", (ev) => {
    state.activeSessionAutoplayMeta = null;
    const d = parseSseJson(ev.data);
    if (d?.message) reg.setSessionStatus(`Error: ${d.message}`);
    reg.setPlannerThinking(false);
  });

  es.addEventListener("error", () => {
    if (es.readyState === EventSource.CLOSED) {
      state.activeSessionAutoplayMeta = null;
      reg.setSessionStatus("Event stream closed.");
      reg.setPlannerThinking(false);
    }
  });

  es.addEventListener("planner_phase", (ev) => {
    if (state.mlxModelLoadingUi) return;
    const d = parseSseJson(ev.data);
    if (!d) return;
    reg.setPlannerThinking(d.phase === "start");
  });

  es.addEventListener("planner_prompt", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d || !el) return;
    if (el.promptUserEl) el.promptUserEl.textContent = d.userPreview || "";
    if (d.systemPreview) {
      if (el.promptSystemEl) el.promptSystemEl.textContent = d.systemPreview;
      el.promptSystemWrap?.classList.remove("hidden");
    } else {
      if (el.promptSystemEl) el.promptSystemEl.textContent = "";
      el.promptSystemWrap?.classList.add("hidden");
    }
  });

  es.addEventListener("transcript_delta", (ev) => {
    const d = parseSseJson(ev.data);
    if (!d || typeof d.text !== "string") return;
    const step = typeof d.step === "number" ? d.step : 0;
    bufferOrAddTranscriptChunk(d.text, step);
  });

  es.addEventListener("plan_applied", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d?.plan || !el?.lastPlanEl) return;
    const p = d.plan;
    const mnRaw = d.moveNumber;
    const mn =
      typeof mnRaw === "number" && Number.isFinite(mnRaw)
        ? mnRaw
        : typeof mnRaw === "string" && /^\d+$/.test(mnRaw.trim())
          ? Number(mnRaw.trim())
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
    el.lastPlanEl.textContent = parts.join("\n");
    let needsRender = false;
    if (mn !== null) {
      if (getin) state.getinLineByStep[mn] = getin;
      state.motionGridHintByStep[mn] =
        typeof d.motionGridHint === "string" ? d.motionGridHint : null;
      needsRender = true;
    }
    if (isTerminalTranscriptLayout() && getin && el.autoplayToggle?.checked) {
      preloadTerminalSounds();
      if (mn !== null) {
        state.autoplayTranscriptHoldMove = mn;
      }
      state.autoplayTerminalPromptChain =
        state.autoplayTerminalPromptChain.then(async () => {
          const myMn = mn;
          try {
            if (!el.manualInput || !isTerminalTranscriptLayout()) {
              if (myMn !== null) flushAutoplayHeldTranscript(myMn);
              return;
            }
            await typeTextIntoInput(el.manualInput, getin.trim(), {
              uppercase: true,
              ...reg.typingTimingFromPaceSelect(),
            });
            if (!isTerminalTranscriptLayout() || !el.autoplayToggle?.checked) {
              if (el.manualInput) el.manualInput.value = "";
              if (myMn !== null) flushAutoplayHeldTranscript(myMn);
              return;
            }
            const echoAfterStep =
              myMn !== null && myMn >= 1
                ? myMn - 1
                : Math.max(0, maxTranscriptStep());
            appendTerminalCommandEcho(getin, {
              afterStep: echoAfterStep,
              moveNumber: myMn,
            });
            if (myMn !== null) flushAutoplayHeldTranscript(myMn);
            if (el.manualInput) el.manualInput.value = "";
            renderTranscriptFeed();
          } catch {
            if (myMn !== null) flushAutoplayHeldTranscript(myMn);
            if (el.manualInput) el.manualInput.value = "";
          } finally {
            if (myMn !== null && state.autoplayTranscriptHoldMove === myMn) {
              state.autoplayTranscriptHoldMove = null;
            }
          }
        });
    }
    if (needsRender) {
      renderTranscriptFeed();
    }
  });

  es.addEventListener("turn_end", (ev) => {
    const d = parseSseJson(ev.data);
    const el = elements;
    if (!d?.snapshot || !el?.mapZInput) return;
    window.__lastMapSnap = d.snapshot.map;
    el.mapZInput.value = String(d.snapshot.map.current.z);
    applySnapshot(d.snapshot);
  });

  es.addEventListener("log_line", (ev) => {
    const d = parseSseJson(ev.data);
    if (!d?.line) return;
    const step =
      typeof d.step === "number" && Number.isFinite(d.step) ? d.step : 0;
    appendAutoplayLogLine(d.line, step);
  });

  es.onopen = () => {
    reg.setSessionStatus("Connected — autoplay starting…");
    void reg.refreshModeFromServer();
    void reg.initTextLlmPicker();
  };
}
