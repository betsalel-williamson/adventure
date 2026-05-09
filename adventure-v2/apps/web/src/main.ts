/// <reference types="vite/client" />

import {
  formatReconcilePanel,
  formatWireEventForTranscript,
  parseSseWirePayload
} from "./wireDisplay";

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const transcriptEl = document.querySelector<HTMLElement>("#transcript");
const phaseCurrentEl = document.querySelector<HTMLElement>("#phase-current");
const phaseTimelineEl = document.querySelector<HTMLElement>("#phase-timeline");
const reconcileEl = document.querySelector<HTMLElement>("#reconcile");
const checkpointsEl = document.querySelector<HTMLElement>("#checkpoints");
const runMetaEl = document.querySelector<HTMLElement>("#run-meta");

const log = (line: string): void => {
  if (transcriptEl) {
    const prev = transcriptEl.textContent ?? "";
    transcriptEl.textContent = prev ? `${prev}\n${line}` : line;
  }
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

const run = async (): Promise<void> => {
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
    log(`POST /runs failed: ${start.status}`);
    return;
  }

  const { runId, config } = (await start.json()) as {
    runId: string;
    config: { modelCategory?: string; modelName?: string };
  };

  if (runMetaEl) {
    runMetaEl.textContent = `runId: ${runId} · model: ${config.modelCategory ?? "?"} / ${config.modelName ?? "?"}`;
  }
  log(`(rest) POST /runs → 201 runId=${runId}`);

  const source = new EventSource(`${apiBase}/runs/${runId}/events`);

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
    if (wire.event === "turn" && wire.envelope.kind === "reconcile") {
      const block = formatReconcilePanel(wire.envelope);
      if (reconcileEl && block) {
        reconcileEl.textContent = block;
      }
    }
  };

  source.addEventListener("turn", (event) => {
    handleWireData((event as MessageEvent).data as string, "turn");
  });

  source.addEventListener("phase", (event) => {
    handleWireData((event as MessageEvent).data as string, "phase");
  });

  source.onerror = () => {
    log("(EventSource error — is the API running?)");
    source.close();
  };

  const turnRes = await fetch(`${apiBase}/runs/${runId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "look" })
  });

  if (!turnRes.ok) {
    log(`POST /turns failed: ${turnRes.status}`);
    return;
  }

  log("(rest) POST /turns → 204");

  const cpRes = await fetch(`${apiBase}/runs/${runId}/checkpoints`);
  if (!cpRes.ok) {
    log(`GET /checkpoints failed: ${cpRes.status}`);
    if (checkpointsEl) {
      checkpointsEl.textContent = `GET /checkpoints failed: ${cpRes.status}`;
    }
    return;
  }

  const checkpointsUnknown = await cpRes.json();
  const checkpoints = checkpointsUnknown as { checkpointId: string }[];

  if (checkpointsEl) {
    checkpointsEl.textContent =
      checkpoints.length === 0
        ? "(no checkpoints yet)"
        : `checkpoints (${checkpoints.length}):\n${JSON.stringify(checkpoints, null, 2)}`;
  }

  if (checkpoints.length > 0) {
    const cid = checkpoints[0]!.checkpointId;
    const replayRes = await fetch(`${apiBase}/runs/${runId}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpointId: cid })
    });
    const replayPayload = await replayRes.json();
    log(
      replayRes.ok
        ? `(rest) POST /replay → ${JSON.stringify(replayPayload)}`
        : `(rest) POST /replay failed ${replayRes.status} ${JSON.stringify(replayPayload)}`
    );
    if (checkpointsEl) {
      checkpointsEl.textContent += `\n\nPOST /replay (first checkpoint):\n${JSON.stringify(replayPayload, null, 2)}`;
    }
  }
};

void run();
