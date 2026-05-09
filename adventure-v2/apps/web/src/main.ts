/// <reference types="vite/client" />

import {
  formatCognitionTracePanel,
  formatReconcilePanel,
  formatWireEventForTranscript,
  parseSseWirePayload
} from "./wireDisplay.js";
import { appendTranscriptLine } from "./shellState.js";
import { stubPlanNextMove, type StubAutoplayContext } from "./stubAutoplayPlanner.js";

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const transcriptEl = document.querySelector<HTMLElement>("#transcript");
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

let transcriptText = "";
let runId: string | null = null;
let source: EventSource | null = null;
/** Last oracle observation text for stub autoplay context */
let lastOracleOutput: string | undefined;
let autoplayAbort = false;
let autoplayRunning = false;

const setTranscript = (text: string): void => {
  transcriptText = text;
  if (transcriptEl) {
    transcriptEl.textContent = text;
  }
};

const log = (line: string): void => {
  setTranscript(appendTranscriptLine(transcriptText, line));
};

const setPhaseCurrent = (to: string): void => {
  if (phaseCurrentEl) {
    phaseCurrentEl.textContent = `current: ${to}`;
  }
};

const appendPhaseTimeline = (line: string): void => {
  if (phaseTimelineEl) {
    const prev = phaseTimelineEl.textContent ?? "";
    const next = prev.includes("no phase transitions") ? line : `${prev}\n${line}`;
    phaseTimelineEl.textContent = next;
  }
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
    return;
  }
  const checkpointsUnknown = await cpRes.json();
  const checkpoints = checkpointsUnknown as { checkpointId: string }[];
  checkpointsEl.textContent =
    checkpoints.length === 0
      ? "(no checkpoints yet — complete a turn)"
      : `checkpoints (${checkpoints.length}):\n${JSON.stringify(checkpoints, null, 2)}`;
};

const handleWireData = (raw: string, eventType: string): void => {
  const wire = parseSseWirePayload(raw);
  if (!wire) {
    log(`[parse error] event=${eventType} raw=${raw.slice(0, 200)}…`);
    return;
  }
  log(formatWireEventForTranscript(wire));
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
    cognitionTraceEl.textContent = formatCognitionTracePanel(wire.trace);
  }
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
    log(`(rest) POST /turns → 204 input=${JSON.stringify(trimmed)}`);
    await refreshCheckpointsPanel();
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
};

const AUTOPLAY_MAX_MOVES = 8;
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

const bootstrap = async (): Promise<void> => {
  const body = {
    config: {
      scenarioId: "dev-shell",
      modelCategory: "SLM" as const,
      modelName: "slm-baseline",
      seed: 1
    }
  };

  const start = await fetch(`${apiBase}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!start.ok) {
    setTranscript(`POST /runs failed: ${start.status}`);
    return;
  }

  const { runId: id, config } = (await start.json()) as {
    runId: string;
    config: { modelCategory?: string; modelName?: string };
  };
  runId = id;

  if (runMetaEl) {
    runMetaEl.textContent = `runId: ${runId} · model: ${config.modelCategory ?? "?"} / ${config.modelName ?? "?"}`;
  }
  setTranscript(`(rest) POST /runs → 201 runId=${runId}\n(Stream open — type a command and press Send.)`);

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

  if (checkpointsEl) {
    checkpointsEl.textContent = "(no turns yet)";
  }

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
};

void bootstrap();
