import type {
  CreateRunRequest,
  CreateRunResponse,
  SseWireEvent,
} from "@contracts";
import type { HealthWireBody } from "../status/health.js";
import { parseSseWirePayload } from "../wire/parse.js";

const defaultRunBody = (): CreateRunRequest => ({
  config: {
    scenarioId: "benchmark-scenario-1",
    modelCategory: "SLM",
    modelName: "slm-baseline",
    seed: 42,
  },
});

export async function fetchHealth(apiBase: string): Promise<{
  ok: boolean;
  body: HealthWireBody | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/health`);
    if (!res.ok) {
      return { ok: false, body: null, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as HealthWireBody;
    return { ok: true, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, body: null, error: msg };
  }
}

export async function createRun(
  apiBase: string,
): Promise<{ runId: string } | { error: string }> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultRunBody()),
    });
    if (!res.ok) {
      return { error: `POST /runs failed: HTTP ${res.status}` };
    }
    const body = (await res.json()) as CreateRunResponse;
    return { runId: body.runId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function postTurn(
  apiBase: string,
  runId: string,
  input: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch(
      `${apiBase.replace(/\/$/, "")}/runs/${runId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      },
    );
    if (res.status !== 204) {
      return { error: `POST /turns failed: HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export type RunEventSourceHandle = {
  close: () => void;
};

/**
 * Subscribe to SSE; invokes handler for each parsed wire event.
 */
export function openRunEventSource(
  apiBase: string,
  runId: string,
  onEvent: (ev: SseWireEvent) => void,
  onConnectionError: () => void,
  onOpen?: () => void,
): RunEventSourceHandle {
  const url = `${apiBase.replace(/\/$/, "")}/runs/${runId}/events`;
  const es = new EventSource(url);

  // Server sends `event: turn|phase|trace` (see adventure-v2 createServer writeSse).
  // `onmessage` only receives the default event type, so it would never fire.
  const onWireMessage = (msg: MessageEvent): void => {
    const wire = parseSseWirePayload(String(msg.data));
    if (wire) {
      onEvent(wire);
    }
  };

  es.addEventListener("turn", onWireMessage);
  es.addEventListener("phase", onWireMessage);
  es.addEventListener("trace", onWireMessage);

  es.onopen = () => {
    onOpen?.();
  };

  es.onerror = () => {
    onConnectionError();
  };

  return {
    close: () => {
      es.close();
    },
  };
}
