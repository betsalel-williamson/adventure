/// <reference types="vite/client" />

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const transcriptEl = document.querySelector<HTMLElement>("#transcript");
const phaseEl = document.querySelector<HTMLElement>("#phase");
const checkpointsEl = document.querySelector<HTMLElement>("#checkpoints");

const log = (line: string): void => {
  if (transcriptEl) {
    transcriptEl.textContent = `${transcriptEl.textContent ?? ""}${line}\n`;
  }
};

const setPhase = (to: string): void => {
  if (phaseEl) {
    phaseEl.textContent = `control phase: ${to}`;
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

  const { runId } = (await start.json()) as { runId: string };
  log(`runId: ${runId}`);

  const source = new EventSource(`${apiBase}/runs/${runId}/events`);

  source.addEventListener("turn", (event) => {
    log(`[turn] ${(event as MessageEvent).data}`);
  });

  source.addEventListener("phase", (event) => {
    const raw = (event as MessageEvent).data as string;
    log(`[phase] ${raw}`);
    try {
      const parsed = JSON.parse(raw) as { transition?: { to?: string } };
      const to = parsed.transition?.to;
      if (to) {
        setPhase(to);
      }
    } catch {
      /* ignore */
    }
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
        ? `[replay restore] ${JSON.stringify(replayPayload)}`
        : `[replay failed] ${replayRes.status} ${JSON.stringify(replayPayload)}`
    );
    if (checkpointsEl) {
      checkpointsEl.textContent += `\n\nPOST /replay (first checkpoint):\n${JSON.stringify(replayPayload, null, 2)}`;
    }
  }
};

void run();
