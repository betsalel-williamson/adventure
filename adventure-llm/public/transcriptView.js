import { elements } from "./dashboardElementRefs.js";
import { state } from "./dashboardState.js";
import {
  blockBodyChronological,
  effectiveTerminalEchoAfterStep,
  sortTranscriptBlocksChronological,
  collapseTerminalGameTrailingNewlines,
} from "./transcriptLayoutLogic.js";
import { preloadTerminalSounds } from "./terminalTyper.js";

export const TRANSCRIPT_LAYOUT_KEY = "adventureTranscriptLayout";
export const TRANSCRIPT_SCROLL_BOTTOM_EPS_PX = 48;

export function isTerminalTranscriptLayout() {
  return document.body.classList.contains("transcript-layout--terminal");
}

/**
 * @param {"classic" | "terminal"} mode
 */
export function applyTranscriptLayout(mode) {
  const el = elements;
  const isTerminal = mode === "terminal";
  const wasTerminal = isTerminalTranscriptLayout();
  document.body.classList.toggle("transcript-layout--terminal", isTerminal);
  try {
    localStorage.setItem(TRANSCRIPT_LAYOUT_KEY, mode);
  } catch {
    /* ignore */
  }
  if (el?.transcriptLayoutToggle) {
    el.transcriptLayoutToggle.checked = isTerminal;
    if (isTerminal) {
      el.transcriptLayoutToggle.setAttribute("checked", "");
    } else {
      el.transcriptLayoutToggle.removeAttribute("checked");
    }
  }

  renderTranscriptFeed();
  if (
    isTerminal &&
    !wasTerminal &&
    el?.manualInput &&
    !el.manualInput.disabled
  ) {
    preloadTerminalSounds();
    el.manualInput.focus();
  }
}

export function initTranscriptLayout() {
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
  const cmd = state.getinLineByStep[step];
  const hint = state.motionGridHintByStep[step];
  const hintSuffix =
    typeof hint === "string" && hint.length > 0 ? ` · ${hint}` : "";
  if (cmd) return `Step ${step} · ${cmd}${hintSuffix}`;
  return `Step ${step} · (GETIN pending or unknown)${hintSuffix}`;
}

function blockBodyText(b) {
  return b.parts.join("");
}

export function maxTranscriptStep() {
  if (state.transcriptBlocks.length === 0) return 0;
  return Math.max(...state.transcriptBlocks.map((b) => b.step), 0);
}

/**
 * @param {string} line raw command (trimmed)
 * @param {{ afterStep?: number; moveNumber?: number | null }} [options]
 */
export function appendTerminalCommandEcho(line, options = {}) {
  if (!isTerminalTranscriptLayout() || !line) return;
  state.terminalEchoSeq += 1;
  const seq = state.terminalEchoSeq;
  const afterStep =
    typeof options.afterStep === "number" && Number.isFinite(options.afterStep)
      ? Math.max(0, Math.floor(options.afterStep))
      : maxTranscriptStep();
  const moveNumber =
    typeof options.moveNumber === "number" &&
    Number.isFinite(options.moveNumber)
      ? Math.floor(options.moveNumber)
      : null;
  state.terminalEchoQueue.push({
    afterStep,
    line,
    seq,
    moveNumber,
  });
}

/**
 * @param {DocumentFragment} frag
 * @param {{ line: string; seq: number }} e
 */
function appendTerminalEchoPre(frag, e) {
  const wrap = document.createElement("div");
  wrap.className =
    "transcript-block transcript-block--terminal transcript-block--echo";
  const pre = document.createElement("pre");
  pre.className = "transcript-body transcript-terminal-echo-line";
  pre.textContent = `> ${e.line.toUpperCase()}\n`;
  wrap.appendChild(pre);
  frag.appendChild(wrap);
}

export function renderTranscriptFeed() {
  const el = elements;
  if (!el?.transcriptEl) return;
  const terminal = isTerminalTranscriptLayout();
  const { transcriptEl } = el;
  const prevScrollTop = transcriptEl.scrollTop;
  const prevScrollHeight = transcriptEl.scrollHeight;
  const wasAtBottom =
    prevScrollHeight - prevScrollTop - transcriptEl.clientHeight <=
    TRANSCRIPT_SCROLL_BOTTOM_EPS_PX;

  transcriptEl.replaceChildren();
  const frag = document.createDocumentFragment();
  if (terminal) {
    const sorted = sortTranscriptBlocksChronological(state.transcriptBlocks);
    const echoes = [...state.terminalEchoQueue].sort((a, b) => a.seq - b.seq);
    /** @type {Set<number>} */
    const emittedEchoSeq = new Set();

    function firstBlockAfterEcho(afterStep) {
      return sorted.find((x) => x.step > afterStep) ?? null;
    }

    for (const b of sorted) {
      for (const e of echoes) {
        if (emittedEchoSeq.has(e.seq)) continue;
        const afterEff = effectiveTerminalEchoAfterStep(
          e,
          sorted,
          state.getinLineByStep,
        );
        const next = firstBlockAfterEcho(afterEff);
        if (next !== null && next.step === b.step) {
          appendTerminalEchoPre(frag, e);
          emittedEchoSeq.add(e.seq);
        }
      }
      const wrap = document.createElement("div");
      wrap.className = "transcript-block transcript-block--terminal";
      const pre = document.createElement("pre");
      pre.className = "transcript-body transcript-terminal-game";
      pre.textContent = collapseTerminalGameTrailingNewlines(
        blockBodyChronological(b),
      );
      wrap.appendChild(pre);
      frag.appendChild(wrap);
    }
    for (const e of echoes) {
      if (!emittedEchoSeq.has(e.seq)) {
        appendTerminalEchoPre(frag, e);
      }
    }
  } else {
    for (const b of state.transcriptBlocks) {
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
    if (!el?.transcriptEl) return;
    if (terminal) {
      if (wasAtBottom || prevScrollHeight === 0) {
        el.transcriptEl.scrollTop = el.transcriptEl.scrollHeight;
      } else {
        const delta = el.transcriptEl.scrollHeight - prevScrollHeight;
        el.transcriptEl.scrollTop = prevScrollTop + delta;
      }
    } else {
      el.transcriptEl.scrollTop = 0;
    }
  });
}

/**
 * @param {string} line
 * @param {number} step
 */
export function appendAutoplayLogLine(line, step) {
  const el = elements;
  if (!el?.autoplayLogEl) return;
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
  el.autoplayLogEl.insertBefore(row, el.autoplayLogEl.firstChild);
  el.autoplayLogEl.scrollTop = 0;
}

/**
 * @param {string} text
 * @param {number} step
 */
export function addTranscriptChunk(text, step) {
  const s = typeof step === "number" && Number.isFinite(step) ? step : 0;
  const head = state.transcriptBlocks[0];
  if (head && head.step === s) {
    head.parts.unshift(text);
  } else {
    state.transcriptBlocks.unshift({
      step: s,
      parts: [text],
    });
  }
  renderTranscriptFeed();
}

export function resetTranscriptFeed() {
  const el = elements;
  state.transcriptBlocks = [];
  state.terminalEchoQueue = [];
  state.terminalEchoSeq = 0;
  state.autoplayTerminalPromptChain = Promise.resolve();
  clearAutoplayTranscriptHoldState();
  for (const k of Object.keys(state.getinLineByStep)) {
    delete state.getinLineByStep[Number(k)];
  }
  for (const k of Object.keys(state.motionGridHintByStep)) {
    delete state.motionGridHintByStep[Number(k)];
  }
  if (el?.autoplayLogEl) el.autoplayLogEl.replaceChildren();
  renderTranscriptFeed();
}

/**
 * @param {string} text
 * @param {number} step
 */
export function bufferOrAddTranscriptChunk(text, step) {
  const el = elements;
  const s = typeof step === "number" && Number.isFinite(step) ? step : 0;
  if (
    state.autoplayTranscriptHoldMove !== null &&
    s === state.autoplayTranscriptHoldMove &&
    isTerminalTranscriptLayout() &&
    el?.autoplayToggle?.checked
  ) {
    const arr = state.autoplayTranscriptHoldBuffer.get(s) ?? [];
    arr.push(text);
    state.autoplayTranscriptHoldBuffer.set(s, arr);
    return;
  }
  addTranscriptChunk(text, step);
}

/**
 * @param {number} moveStep
 */
export function flushAutoplayHeldTranscript(moveStep) {
  const arr = state.autoplayTranscriptHoldBuffer.get(moveStep);
  state.autoplayTranscriptHoldBuffer.delete(moveStep);
  if (!arr || arr.length === 0) return;
  addTranscriptChunk(arr.join(""), moveStep);
}

export function clearAutoplayTranscriptHoldState() {
  state.autoplayTranscriptHoldMove = null;
  state.autoplayTranscriptHoldBuffer.clear();
}
