/// <reference types="vite/client" />

import {
  appendCognitionTraceEntry,
  COGNITION_TRACE_EMPTY_PLACEHOLDER,
  formatReconcilePanel,
  formatVirtualTerminalUserEcho,
  formatVirtualTerminalWireChunk,
  formatWireEventForTranscript,
  parseSseWirePayload
} from "./wireDisplay.js";
import mermaid from "mermaid";
import {
  clearAgentDiagramStorage,
  effectiveBrainMermaid,
  effectiveControlMermaid,
  loadAgentDiagramStorage,
  saveAgentDiagramStorage,
  type AgentDiagramStorage
} from "./agentDiagramSettings.js";
import { BRAIN_GRAPH_MERMAID, CONTROL_MACHINE_MERMAID } from "./agentDiagrams.js";
import {
  loadPersistedSession,
  savePersistedSession,
  type PersistedShellSessionV1
} from "./shellSessionPersistence.js";
import { appendTranscriptLine } from "./shellState.js";
import { stubPlanNextMove, type StubAutoplayContext } from "./stubAutoplayPlanner.js";

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const sessionLoadingEl = document.querySelector<HTMLElement>("#session-loading");
const gameTerminalEl = document.querySelector<HTMLElement>("#game-terminal");
const transcriptEl = document.querySelector<HTMLElement>("#transcript");
const showRawSseEl = document.querySelector<HTMLInputElement>("#show-raw-sse");
const rawSseBlockEl = document.querySelector<HTMLElement>("#raw-sse-block");
const phaseCurrentEl = document.querySelector<HTMLElement>("#phase-current");
const phaseTimelineEl = document.querySelector<HTMLElement>("#phase-timeline");
const reconcileEl = document.querySelector<HTMLElement>("#reconcile");
const checkpointsEl = document.querySelector<HTMLElement>("#checkpoints");
const cognitionTraceEl = document.querySelector<HTMLElement>("#cognition-trace");
const runMetaEl = document.querySelector<HTMLElement>("#run-meta");
const commandInputEl = document.querySelector<HTMLInputElement>("#command");
const sendBtnEl = document.querySelector<HTMLButtonElement>("#send");
const replayDemoBtnEl = document.querySelector<HTMLButtonElement>("#replay-demo");
const autoplayBtnEl = document.querySelector<HTMLButtonElement>("#autoplay");
const stopAutoplayBtnEl = document.querySelector<HTMLButtonElement>("#stop-autoplay");
const useBundledDiagramsEl = document.querySelector<HTMLInputElement>("#use-bundled-diagrams");
const diagramCustomEditorEl = document.querySelector<HTMLElement>("#diagram-custom-editor");
const diagramBrainEditEl = document.querySelector<HTMLTextAreaElement>("#diagram-brain-edit");
const diagramControlEditEl = document.querySelector<HTMLTextAreaElement>("#diagram-control-edit");
const cognitionProfileEl = document.querySelector<HTMLInputElement>("#cognition-profile");
const restoreSessionBtnEl = document.querySelector<HTMLButtonElement>("#restore-session-snapshot");

let transcriptText = "";
let gameTerminalText = "";
let cognitionTraceText = COGNITION_TRACE_EMPTY_PLACEHOLDER;
let runId: string | null = null;
let source: EventSource | null = null;
/** Last oracle observation text for stub autoplay context */
let lastOracleOutput: string | undefined;
let autoplayAbort = false;
let autoplayRunning = false;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let uiListenersAttached = false;

const showSessionLoading = (show: boolean): void => {
  if (!sessionLoadingEl) {
    return;
  }
  if (show) {
    sessionLoadingEl.classList.add("session-loading-visible");
  } else {
    sessionLoadingEl.classList.remove("session-loading-visible");
  }
};

const gatherSessionSnapshot = (): PersistedShellSessionV1 | null => {
  if (!runId) {
    return null;
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    apiBase,
    runId,
    transcriptText,
    gameTerminalText,
    cognitionTraceText,
    phaseTimelineText: phaseTimelineEl?.textContent ?? "",
    phaseCurrentText: phaseCurrentEl?.textContent ?? "",
    reconcileText: reconcileEl?.textContent ?? "",
    checkpointsText: checkpointsEl?.textContent ?? "",
    runMetaDisplay: runMetaEl?.textContent ?? "",
    cognitionProfileInput: cognitionProfileEl?.value ?? ""
  };
};

const schedulePersistSession = (): void => {
  if (!runId) {
    return;
  }
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const snap = gatherSessionSnapshot();
    if (snap) {
      savePersistedSession(snap);
    }
  }, 250);
};

const applyPersistedToShell = (p: PersistedShellSessionV1): void => {
  transcriptText = p.transcriptText;
  gameTerminalText = p.gameTerminalText;
  cognitionTraceText = p.cognitionTraceText;
  if (transcriptEl) {
    transcriptEl.textContent = p.transcriptText;
  }
  if (gameTerminalEl) {
    gameTerminalEl.textContent = p.gameTerminalText;
  }
  if (cognitionTraceEl) {
    cognitionTraceEl.textContent = p.cognitionTraceText;
  }
  if (phaseTimelineEl) {
    phaseTimelineEl.textContent = p.phaseTimelineText;
  }
  if (phaseCurrentEl) {
    phaseCurrentEl.textContent = p.phaseCurrentText;
  }
  if (reconcileEl) {
    reconcileEl.textContent = p.reconcileText;
  }
  if (checkpointsEl) {
    checkpointsEl.textContent = p.checkpointsText;
  }
  if (runMetaEl) {
    runMetaEl.textContent = p.runMetaDisplay;
  }
  if (cognitionProfileEl) {
    cognitionProfileEl.value = p.cognitionProfileInput;
  }
};

const setTranscript = (text: string): void => {
  transcriptText = text;
  if (transcriptEl) {
    transcriptEl.textContent = text;
  }
  schedulePersistSession();
};

const setGameTerminal = (text: string): void => {
  gameTerminalText = text;
  if (gameTerminalEl) {
    gameTerminalEl.textContent = text;
  }
  schedulePersistSession();
};

const appendGameTerminalLine = (line: string): void => {
  setGameTerminal(appendTranscriptLine(gameTerminalText, line));
};

const log = (line: string): void => {
  setTranscript(appendTranscriptLine(transcriptText, line));
};

const setPhaseCurrent = (to: string): void => {
  if (phaseCurrentEl) {
    phaseCurrentEl.textContent = `current: ${to}`;
  }
  schedulePersistSession();
};

const appendPhaseTimeline = (line: string): void => {
  if (phaseTimelineEl) {
    const prev = phaseTimelineEl.textContent ?? "";
    const next = prev.includes("no phase transitions") ? line : `${prev}\n${line}`;
    phaseTimelineEl.textContent = next;
  }
  schedulePersistSession();
};

const setShellBusy = (busy: boolean): void => {
  if (commandInputEl) {
    commandInputEl.disabled = busy;
  }
  if (sendBtnEl) {
    sendBtnEl.disabled = busy;
  }
  if (autoplayBtnEl) {
    autoplayBtnEl.disabled = busy;
  }
};

const refreshCheckpointsPanel = async (): Promise<void> => {
  if (!runId || !checkpointsEl) {
    return;
  }
  const cpRes = await fetch(`${apiBase}/runs/${runId}/checkpoints`);
  if (!cpRes.ok) {
    checkpointsEl.textContent = `GET /checkpoints failed: ${cpRes.status}`;
    schedulePersistSession();
    return;
  }
  const checkpointsUnknown = await cpRes.json();
  const checkpoints = checkpointsUnknown as { checkpointId: string }[];
  checkpointsEl.textContent =
    checkpoints.length === 0
      ? "(no checkpoints yet — complete a turn)"
      : `checkpoints (${checkpoints.length}):\n${JSON.stringify(checkpoints, null, 2)}`;
  schedulePersistSession();
};

const handleWireData = (raw: string, eventType: string): void => {
  const wire = parseSseWirePayload(raw);
  if (!wire) {
    log(`[parse error] event=${eventType} raw=${raw.slice(0, 200)}…`);
    return;
  }
  log(formatWireEventForTranscript(wire));
  const vtChunk = formatVirtualTerminalWireChunk(wire);
  if (vtChunk) {
    appendGameTerminalLine(vtChunk);
  }
  if (wire.event === "phase") {
    appendPhaseTimeline(formatWireEventForTranscript(wire));
    setPhaseCurrent(wire.transition.to);
  }
  if (wire.event === "turn" && wire.envelope.kind === "oracle_observation") {
    const out = wire.envelope.payload as { output?: unknown };
    lastOracleOutput =
      typeof out.output === "string" ? out.output : JSON.stringify(out.output ?? "");
  }
  if (wire.event === "turn" && wire.envelope.kind === "reconcile") {
    const block = formatReconcilePanel(wire.envelope);
    if (reconcileEl && block) {
      reconcileEl.textContent = block;
    }
  }
  if (wire.event === "trace" && cognitionTraceEl) {
    cognitionTraceText = appendCognitionTraceEntry(cognitionTraceText, wire.trace);
    cognitionTraceEl.textContent = cognitionTraceText;
  }
  schedulePersistSession();
};

const submitTurn = async (input: string): Promise<boolean> => {
  if (!runId) {
    return false;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }
  setShellBusy(true);
  try {
    const turnRes = await fetch(`${apiBase}/runs/${runId}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: trimmed })
    });
    if (!turnRes.ok) {
      log(`POST /turns failed: ${turnRes.status}`);
      return false;
    }
    const echo = formatVirtualTerminalUserEcho(trimmed);
    if (echo) {
      appendGameTerminalLine(echo);
    }
    log(`(rest) POST /turns → 204 input=${JSON.stringify(trimmed)}`);
    await refreshCheckpointsPanel();
    schedulePersistSession();
    return true;
  } finally {
    if (!autoplayRunning) {
      setShellBusy(false);
    }
  }
};

const runReplayDemo = async (): Promise<void> => {
  if (!runId || !checkpointsEl) {
    return;
  }
  const cpRes = await fetch(`${apiBase}/runs/${runId}/checkpoints`);
  if (!cpRes.ok) {
    log(`GET /checkpoints failed: ${cpRes.status}`);
    return;
  }
  const checkpointsUnknown = await cpRes.json();
  const checkpoints = checkpointsUnknown as { checkpointId: string }[];
  if (checkpoints.length === 0) {
    log("(replay demo) no checkpoints yet");
    return;
  }
  const cid = checkpoints[0]!.checkpointId;
  const replayRes = await fetch(`${apiBase}/runs/${runId}/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpointId: cid })
  });
  const replayPayload = await replayRes.json();
  log(
    replayRes.ok
      ? `(replay demo) POST /replay → ${JSON.stringify(replayPayload)}`
      : `(replay demo) POST /replay failed ${replayRes.status} ${JSON.stringify(replayPayload)}`
  );
  if (checkpointsEl) {
    checkpointsEl.textContent += `\n\nPOST /replay (first checkpoint):\n${JSON.stringify(replayPayload, null, 2)}`;
  }
  schedulePersistSession();
};

const AUTOPLAY_MAX_MOVES = 10;
const AUTOPLAY_DELAY_MS = 400;

const runAutoplayStub = async (): Promise<void> => {
  if (!runId || autoplayRunning) {
    return;
  }
  autoplayRunning = true;
  autoplayAbort = false;
  if (stopAutoplayBtnEl) {
    stopAutoplayBtnEl.disabled = false;
  }
  setShellBusy(true);

  let ctx: StubAutoplayContext = { moveIndex: 0, lastOracleOutput };

  for (let i = 0; i < AUTOPLAY_MAX_MOVES; i++) {
    if (autoplayAbort) {
      log("(autoplay) stopped");
      break;
    }
    const next = stubPlanNextMove(ctx);
    log(`(autoplay) move ${i + 1}/${AUTOPLAY_MAX_MOVES} → ${JSON.stringify(next)}`);
    const ok = await submitTurn(next);
    if (!ok) {
      break;
    }
    ctx = { moveIndex: ctx.moveIndex + 1, lastOracleOutput };
    await new Promise((r) => setTimeout(r, AUTOPLAY_DELAY_MS));
  }

  autoplayRunning = false;
  if (stopAutoplayBtnEl) {
    stopAutoplayBtnEl.disabled = true;
  }
  setShellBusy(false);
};

const renderAgentDiagrams = async (brain: string, control: string): Promise<void> => {
  const brainEl = document.getElementById("brain-mermaid");
  const ctrlEl = document.getElementById("control-mermaid");
  if (!brainEl || !ctrlEl) {
    return;
  }
  brainEl.removeAttribute("data-processed");
  ctrlEl.removeAttribute("data-processed");
  brainEl.textContent = brain;
  ctrlEl.textContent = control;
  await mermaid.run({ nodes: [brainEl, ctrlEl] });
};

const diagramStorageFromUi = (): AgentDiagramStorage => ({
  useBundled: useBundledDiagramsEl?.checked !== false,
  brain: diagramBrainEditEl?.value,
  control: diagramControlEditEl?.value
});

const syncDiagramEditorVisibility = (): void => {
  const bundled = useBundledDiagramsEl?.checked !== false;
  if (diagramCustomEditorEl) {
    diagramCustomEditorEl.style.display = bundled ? "none" : "";
  }
};

const applyDiagramsFromUi = async (): Promise<void> => {
  const s = diagramStorageFromUi();
  await renderAgentDiagrams(
    effectiveBrainMermaid(BRAIN_GRAPH_MERMAID, s),
    effectiveControlMermaid(CONTROL_MACHINE_MERMAID, s)
  );
};

const setupAgentDiagramPanel = async (): Promise<void> => {
  mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
  const stored = loadAgentDiagramStorage();
  if (useBundledDiagramsEl) {
    useBundledDiagramsEl.checked = stored?.useBundled !== false;
  }
  if (diagramBrainEditEl) {
    diagramBrainEditEl.value =
      stored && stored.useBundled === false && typeof stored.brain === "string"
        ? stored.brain
        : BRAIN_GRAPH_MERMAID;
  }
  if (diagramControlEditEl) {
    diagramControlEditEl.value =
      stored && stored.useBundled === false && typeof stored.control === "string"
        ? stored.control
        : CONTROL_MACHINE_MERMAID;
  }
  syncDiagramEditorVisibility();

  useBundledDiagramsEl?.addEventListener("change", () => {
    syncDiagramEditorVisibility();
    void applyDiagramsFromUi();
  });

  document.getElementById("diagram-apply")?.addEventListener("click", () => {
    void applyDiagramsFromUi();
  });

  document.getElementById("diagram-save-local")?.addEventListener("click", () => {
    saveAgentDiagramStorage({
      useBundled: useBundledDiagramsEl?.checked !== false,
      brain: diagramBrainEditEl?.value,
      control: diagramControlEditEl?.value
    });
  });

  document.getElementById("diagram-reset")?.addEventListener("click", () => {
    clearAgentDiagramStorage();
    if (useBundledDiagramsEl) {
      useBundledDiagramsEl.checked = true;
    }
    if (diagramBrainEditEl) {
      diagramBrainEditEl.value = BRAIN_GRAPH_MERMAID;
    }
    if (diagramControlEditEl) {
      diagramControlEditEl.value = CONTROL_MACHINE_MERMAID;
    }
    syncDiagramEditorVisibility();
    void applyDiagramsFromUi();
  });

  await applyDiagramsFromUi();
};

const attachStreamListeners = (): void => {
  if (!runId) {
    return;
  }
  source?.close();
  source = new EventSource(`${apiBase}/runs/${runId}/events`);

  source.addEventListener("turn", (event) => {
    handleWireData((event as MessageEvent).data as string, "turn");
  });

  source.addEventListener("phase", (event) => {
    handleWireData((event as MessageEvent).data as string, "phase");
  });

  source.addEventListener("trace", (event) => {
    handleWireData((event as MessageEvent).data as string, "trace");
  });

  source.onerror = () => {
    log("(EventSource error — is the API running?)");
    source?.close();
  };
};

/**
 * Creates a new server run. When `mergeAfterSnapshot` is true, keeps existing transcript panels and appends a separator (server restarted / expired run).
 */
const createNewRun = async (mergeAfterSnapshot: boolean): Promise<boolean> => {
  const profileRaw = cognitionProfileEl?.value?.trim();
  const body = {
    config: {
      scenarioId: "dev-shell",
      modelCategory: "SLM" as const,
      modelName: "slm-baseline",
      seed: 1,
      ...(profileRaw !== undefined && profileRaw.length > 0 ? { cognitionProfile: profileRaw } : {})
    }
  };

  const start = await fetch(`${apiBase}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!start.ok) {
    setTranscript(
      mergeAfterSnapshot
        ? `${transcriptText}\nPOST /runs failed: ${start.status}`
        : `POST /runs failed: ${start.status}`
    );
    if (!mergeAfterSnapshot) {
      setGameTerminal(`POST /runs failed: ${start.status}`);
    }
    return false;
  }

  const { runId: id, config } = (await start.json()) as {
    runId: string;
    config: { modelCategory?: string; modelName?: string; cognitionProfile?: string };
  };
  runId = id;

  const profileLabel =
    config.cognitionProfile !== undefined && config.cognitionProfile.length > 0
      ? config.cognitionProfile
      : "(default)";
  if (runMetaEl) {
    runMetaEl.textContent = `runId: ${runId} · model: ${config.modelCategory ?? "?"} / ${config.modelName ?? "?"} · cognitionProfile: ${profileLabel}`;
  }

  if (mergeAfterSnapshot) {
    log(`\n--- New run ${runId} (previous transcript retained above) ---\n`);
    appendGameTerminalLine(`(stream: connected · ${runId})`);
  } else {
    setTranscript(`(rest) POST /runs → 201 runId=${runId}\n(Stream open — type a command and press Send.)`);
    setGameTerminal("(Stream open — type a command and press Send.)");
    cognitionTraceText = COGNITION_TRACE_EMPTY_PLACEHOLDER;
    if (cognitionTraceEl) {
      cognitionTraceEl.textContent = cognitionTraceText;
    }
    if (phaseTimelineEl) {
      phaseTimelineEl.textContent = "(no phase transitions yet)";
    }
    if (phaseCurrentEl) {
      phaseCurrentEl.textContent = "current: —";
    }
    if (reconcileEl) {
      reconcileEl.textContent = "(no reconcile event yet)";
    }
    if (checkpointsEl) {
      checkpointsEl.textContent = "(no turns yet)";
    }
  }

  schedulePersistSession();
  return true;
};

const attachUiListeners = (): void => {
  if (uiListenersAttached) {
    return;
  }
  uiListenersAttached = true;

  showRawSseEl?.addEventListener("change", () => {
    if (rawSseBlockEl) {
      rawSseBlockEl.style.display = showRawSseEl?.checked ? "" : "none";
    }
  });

  sendBtnEl?.addEventListener("click", () => {
    void submitTurn(commandInputEl?.value ?? "");
  });

  commandInputEl?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void submitTurn(commandInputEl?.value ?? "");
    }
  });

  replayDemoBtnEl?.addEventListener("click", () => {
    void runReplayDemo();
  });

  autoplayBtnEl?.addEventListener("click", () => {
    void runAutoplayStub();
  });

  stopAutoplayBtnEl?.addEventListener("click", () => {
    autoplayAbort = true;
  });

  restoreSessionBtnEl?.addEventListener("click", () => {
    const p = loadPersistedSession();
    if (!p) {
      log("(restore) no saved session in this browser");
      return;
    }
    applyPersistedToShell(p);
    log("(restore) reapplied local snapshot (SSE unchanged — refresh to reconnect if the run still exists)");
    schedulePersistSession();
  });
};

const bootstrap = async (): Promise<void> => {
  showSessionLoading(true);
  try {
    await setupAgentDiagramPanel();
    attachUiListeners();

    const persisted = loadPersistedSession();
    let handled = false;

    if (persisted !== null && persisted.apiBase === apiBase && persisted.runId.length > 0) {
      try {
        const cpRes = await fetch(`${apiBase}/runs/${persisted.runId}/checkpoints`);
        if (cpRes.ok) {
          applyPersistedToShell(persisted);
          runId = persisted.runId;
          attachStreamListeners();
          await refreshCheckpointsPanel();
          schedulePersistSession();
          handled = true;
        } else if (cpRes.status === 404) {
          applyPersistedToShell(persisted);
          const ok = await createNewRun(true);
          if (ok) {
            attachStreamListeners();
          }
          handled = ok;
        }
      } catch {
        applyPersistedToShell(persisted);
        runId = persisted.runId;
        attachStreamListeners();
        await refreshCheckpointsPanel().catch(() => {
          /* offline */
        });
        schedulePersistSession();
        log("(session) could not verify run with server — restored snapshot; SSE may reconnect when API is reachable.");
        handled = true;
      }
    }

    if (!handled) {
      const ok = await createNewRun(false);
      if (ok) {
        attachStreamListeners();
      }
    }
  } finally {
    showSessionLoading(false);
  }
};

void bootstrap();
