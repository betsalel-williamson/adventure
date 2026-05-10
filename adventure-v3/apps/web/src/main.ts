/// <reference types="vite/client" />

import type { SseWireEvent } from "@contracts";
import { createRun, fetchHealth, openRunEventSource, postTurn } from "./api/client.js";
import { describeHealthStatus, minimalOracleHint } from "./status/health.js";
import { appendOracleAwareLine } from "./transcript/buffer.js";
import { CRT_AWAITING_ORACLE_PLACEHOLDER } from "./transcript/constants.js";
import { createOracleTurnWaitGate } from "./shell/oracleTurnWait.js";
import { shellClickShouldSkipFocus } from "./shell/shellClickFocus.js";
import { formatUserEchoLine, virtualTerminalChunkFromWire } from "./wire/virtualTerminal.js";
import { formatDefaultAssistancePostureForPanel } from "./posture/assistancePosture.js";
import {
  deriveSessionSignals,
  formatSessionSignalsForPanel
} from "./session/sessionSignals.js";

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const statusStripEl = document.querySelector<HTMLElement>("#status-strip");
const viewportEl = document.querySelector<HTMLElement>("#crt-viewport");
const transcriptEl = document.querySelector<HTMLElement>("#crt-transcript");
const assistancePosturePanelEl =
  document.querySelector<HTMLParagraphElement>("#assistance-posture-panel");
const sessionSignalsPanelEl = document.querySelector<HTMLParagraphElement>("#session-signals-panel");
const assistCoverEl = document.querySelector<HTMLDetailsElement>("details.crt-assist-cover");
const commandLineEl = document.querySelector<HTMLElement>("#crt-command-line");
const commandInputEl = document.querySelector<HTMLInputElement>("#command-input");

let transcriptText = CRT_AWAITING_ORACLE_PLACEHOLDER;
let awaitingOracle = true;
/** Short footer label (Fortran game / Demo oracle / API unreachable). */
let healthShort = "";
/** Tooltip for operators who need detail. */
let healthTooltip = "";
let sseListening = false;
let sseEverOpened = false;
let currentRunId: string | null = null;

let esHandle: { close: () => void } | null = null;

/** Prevents overlapping submits; prefer readOnly over disabled to avoid UA layout/style jumps. */
let turnInFlight = false;

/** Resolves when the next `oracle_observation` is appended (Fortran/game lane painted). */
const oracleTurnWait = createOracleTurnWaitGate();

/**
 * One silent turn after SSE opens: empty player input ⇒ oracle stdin is only `n` (see Fortran bridge).
 * That surfaces INIT / welcome / initial room without an extra `look` that confuses this game build.
 * Proposals stay off the CRT (appendFromWire).
 */
let didSilentBootstrap = false;
const SILENT_BOOTSTRAP_DELAY_MS = 300;

/** Pixels from the bottom to still count as “at bottom” (terminal tail-follow). */
const PIN_TO_BOTTOM_THRESHOLD_PX = 80;

/** After HTTP accepts a turn, unlock the shell if SSE never delivers `oracle_observation`. */
const ORACLE_OBSERVATION_WAIT_MS = 45_000;

const isTranscriptPinnedToBottom = (): boolean => {
  const el = viewportEl ?? transcriptEl;
  if (!el) {
    return true;
  }
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - scrollTop - clientHeight <= PIN_TO_BOTTOM_THRESHOLD_PX;
};

type TranscriptRenderOpts = {
  /**
   * After local input (echo / errors / session start), jump to the latest line like a real shell.
   * Streaming oracle lines only scroll if the user was already following the tail.
   */
  forceScroll?: boolean;
};

/** Snap viewport to transcript tail after layout (textContent updates need a frame for scrollHeight). */
const scrollViewportToTail = (): void => {
  const scrollEl = viewportEl ?? transcriptEl;
  scrollEl.scrollTop = scrollEl.scrollHeight;
};

const syncSessionSignalsAriaLive = (): void => {
  if (!sessionSignalsPanelEl || !assistCoverEl) {
    return;
  }
  sessionSignalsPanelEl.setAttribute("aria-live", assistCoverEl.open ? "polite" : "off");
};

const refreshAssistancePosturePanel = (): void => {
  if (!assistancePosturePanelEl) {
    return;
  }
  assistancePosturePanelEl.textContent = formatDefaultAssistancePostureForPanel().join("\n");
};

const refreshSessionSignalsPanel = (): void => {
  if (!sessionSignalsPanelEl) {
    return;
  }
  const lines = formatSessionSignalsForPanel(deriveSessionSignals(transcriptText));
  sessionSignalsPanelEl.textContent = lines.join("\n");
  syncSessionSignalsAriaLive();
};

const renderTranscript = (opts?: TranscriptRenderOpts): void => {
  if (transcriptEl) {
    const followTail = opts?.forceScroll === true || isTranscriptPinnedToBottom();
    transcriptEl.textContent = transcriptText;
    if (followTail) {
      scrollViewportToTail();
      requestAnimationFrame(() => {
        scrollViewportToTail();
        requestAnimationFrame(scrollViewportToTail);
      });
    }
  }
  refreshSessionSignalsPanel();
};

refreshAssistancePosturePanel();

const refreshStatusStrip = (): void => {
  if (!statusStripEl) {
    return;
  }

  let line = "";
  if (!sseEverOpened) {
    line = "Connecting…";
  } else if (!sseListening) {
    line = "Connection lost — is the API running?";
  } else {
    line = healthShort;
  }

  statusStripEl.textContent = line;
  const streamNote = !sseEverOpened ? "Opening event stream…" : !sseListening ? "SSE disconnected" : "SSE OK";
  statusStripEl.title = `${healthTooltip} · ${streamNote}`;
  const trouble = Boolean(!sseListening && sseEverOpened);
  statusStripEl.classList.toggle("shell-footer--bad", trouble);
};

const appendFromWire = (wire: SseWireEvent): void => {
  /** Game-first CRT: hide cognition proposal lines; keep oracle + user-typed echoes only. */
  if (wire.event === "turn" && wire.envelope.kind === "proposal") {
    return;
  }

  const chunk = virtualTerminalChunkFromWire(wire);
  if (chunk === null) {
    return;
  }
  const isOracle =
    wire.event === "turn" && wire.envelope.kind === "oracle_observation";
  const next = appendOracleAwareLine(transcriptText, chunk, {
    awaitingOracle,
    isOracleChunk: isOracle
  });
  transcriptText = next.text;
  awaitingOracle = next.awaitingOracle;
  renderTranscript();

  if (isOracle) {
    oracleTurnWait.notifyOraclePainted();
  }
};

const setCommandLineLocked = (locked: boolean): void => {
  if (commandInputEl) {
    commandInputEl.readOnly = locked;
  }
};

const setCommandLineAwaitingOracle = (awaiting: boolean): void => {
  commandLineEl?.classList.toggle("crt-command-line--awaiting-oracle", awaiting);
};

const loadHealth = async (): Promise<void> => {
  const h = await fetchHealth(apiBase);
  healthShort = minimalOracleHint(h.body, { fetchError: h.error });
  healthTooltip = h.error
    ? describeHealthStatus(null, { fetchError: h.error })
    : `${describeHealthStatus(h.body, {})} (${apiBase})`;
  refreshStatusStrip();
};

const submitPlayerInput = async (raw: string): Promise<void> => {
  if (turnInFlight) {
    return;
  }

  if (!currentRunId || !esHandle) {
    const errLine = appendOracleAwareLine(
      transcriptText,
      "Session not ready — reload the page.",
      { awaitingOracle, isOracleChunk: false }
    );
    transcriptText = errLine.text;
    awaitingOracle = errLine.awaitingOracle;
    renderTranscript({ forceScroll: true });
    return;
  }

  const line = raw.trim().toUpperCase();
  if (!line) {
    return;
  }

  turnInFlight = true;
  setCommandLineLocked(true);

  const oracleWait = oracleTurnWait.beginWait();

  try {
    const echo = formatUserEchoLine(line);
    const echoed = appendOracleAwareLine(transcriptText, echo, {
      awaitingOracle,
      isOracleChunk: false
    });
    transcriptText = echoed.text;
    awaitingOracle = echoed.awaitingOracle;
    renderTranscript({ forceScroll: true });

    // Hide only the *next* live prompt until Fortran/oracle output paints; scrollback keeps `> …` echo.
    setCommandLineAwaitingOracle(true);

    if (commandInputEl) {
      commandInputEl.value = "";
    }

    const res = await postTurn(apiBase, currentRunId, line);

    if ("error" in res) {
      oracleWait.cancel();
      const err = appendOracleAwareLine(transcriptText, `[error] ${res.error}`, {
        awaitingOracle,
        isOracleChunk: false
      });
      transcriptText = err.text;
      awaitingOracle = err.awaitingOracle;
      renderTranscript({ forceScroll: true });
    } else {
      const outcome = await Promise.race([
        oracleWait.promise.then(() => "oracle" as const),
        new Promise<"timeout">((resolve) => {
          window.setTimeout(() => resolve("timeout"), ORACLE_OBSERVATION_WAIT_MS);
        })
      ]);
      if (outcome === "timeout") {
        oracleWait.cancel();
        const err = appendOracleAwareLine(
          transcriptText,
          "[error] Game output did not arrive in time — check the API connection or reload.",
          { awaitingOracle, isOracleChunk: false }
        );
        transcriptText = err.text;
        awaitingOracle = err.awaitingOracle;
        renderTranscript({ forceScroll: true });
      }
    }
  } finally {
    turnInFlight = false;
    setCommandLineLocked(false);
    setCommandLineAwaitingOracle(false);
    if (commandInputEl) {
      commandInputEl.value = "";
      commandInputEl.focus({ preventScroll: true });
    }
  }
};

const bootstrap = async (): Promise<void> => {
  await loadHealth();

  const run = await createRun(apiBase);
  if ("error" in run) {
    transcriptText = `Cannot start game session: ${run.error}`;
    awaitingOracle = false;
    renderTranscript({ forceScroll: true });
    return;
  }

  currentRunId = run.runId;

  sseListening = true;
  sseEverOpened = false;
  refreshStatusStrip();

  transcriptText = CRT_AWAITING_ORACLE_PLACEHOLDER;
  awaitingOracle = true;
  renderTranscript({ forceScroll: true });

  esHandle = openRunEventSource(
    apiBase,
    run.runId,
    appendFromWire,
    () => {
      sseListening = false;
      refreshStatusStrip();
    },
    () => {
      sseEverOpened = true;
      sseListening = true;
      refreshStatusStrip();

      if (didSilentBootstrap) {
        return;
      }
      didSilentBootstrap = true;
      window.setTimeout(() => {
        void postTurn(apiBase, run.runId, "");
      }, SILENT_BOOTSTRAP_DELAY_MS);
    }
  );

  commandInputEl?.focus({ preventScroll: true });
};

assistCoverEl?.addEventListener("toggle", () => {
  syncSessionSignalsAriaLive();
});

void bootstrap();

commandInputEl?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    void submitPlayerInput(commandInputEl?.value ?? "");
  }
});

/** Click-to-focus: shell behaves like a terminal (typing anywhere targets the command line). */
document.addEventListener("click", (ev: MouseEvent) => {
  const t = ev.target;
  if (!(t instanceof Element)) {
    return;
  }
  if (shellClickShouldSkipFocus(t)) {
    return;
  }
  commandInputEl?.focus({ preventScroll: true });
});
