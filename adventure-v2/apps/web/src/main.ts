/// <reference types="vite/client" />

const apiBase: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const transcriptEl = document.querySelector<HTMLElement>("#transcript");
const phaseEl = document.querySelector<HTMLElement>("#phase");

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
  }
};

void run();
