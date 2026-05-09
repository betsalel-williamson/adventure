import { describe, expect, it } from "vitest";
import {
  listCheckpointsResponseSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  sseWireEventSchema,
  type SseWireEvent
} from "../packages/contracts/src/index.js";
import {
  RunCoordinator,
  createProcessOracleBridge,
  createSyntheticOracleBridge,
  listenAdventureServer,
  type OracleBridge
} from "../apps/server/src/index.js";
import { closeServer } from "./helpers/closeServer.js";
import { oracleStubPath } from "./fixturePaths.js";
import { createRunConfig } from "./steps/runSteps.js";

const readSseUntilCount = async (
  res: globalThis.Response,
  count: number,
  timeMs: number = 5000
): Promise<SseWireEvent[]> => {
  if (!res.body) {
    throw new Error("No response body");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const out: SseWireEvent[] = [];
  const deadline = Date.now() + timeMs;
  while (out.length < count && Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6);
          const parsed = JSON.parse(raw) as unknown;
          out.push(sseWireEventSchema.parse(parsed));
        }
      }
    }
  }
  await reader.cancel();
  return out;
};

describe("HTTP API + SSE", () => {
  it("streams turn and phase events in order for one turn after POST /turns", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      expect(start.status).toBe(201);
      const { runId } = (await start.json()) as { runId: string };

      const sseRes = await fetch(`${baseUrl}/runs/${runId}/events`);
      expect(sseRes.ok).toBe(true);

      const readPromise = readSseUntilCount(sseRes, 7);

      const turn = await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });
      expect(turn.status).toBe(204);

      const wire = await readPromise;

      const turnKinds = wire
        .filter((w): w is Extract<SseWireEvent, { event: "turn" }> => w.event === "turn")
        .map((w) => w.envelope.kind);
      expect(turnKinds).toEqual(["proposal", "oracle_observation", "reconcile", "checkpoint"]);

      const phases = wire
        .filter((w): w is Extract<SseWireEvent, { event: "phase" }> => w.event === "phase")
        .map((w) => w.transition.to);
      expect(phases).toEqual(["disorder", "act"]);

      const trace = wire.find(
        (w): w is Extract<SseWireEvent, { event: "trace" }> => w.event === "trace"
      );
      expect(trace).toBeDefined();
      expect(trace!.trace).toMatchObject({
        runId,
        turnId: `${runId}:turn:1`,
        sequence: 1,
        nodeId: "proposal",
        label: "Proposal drafted",
        payload: { action: "look" }
      });
    } finally {
      await closeServer(server);
    }
  });

  it("uses injected oracle output on the wire without changing route shape", async () => {
    const customOracle: OracleBridge = {
      observe: () => ({ rejected: false, output: "INJECTED-ORACLE-OUTPUT" })
    };
    const coordinator = new RunCoordinator(customOracle);
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("API") })
      });
      const { runId } = (await start.json()) as { runId: string };

      const sseRes = await fetch(`${baseUrl}/runs/${runId}/events`);
      const readPromise = readSseUntilCount(sseRes, 6);
      await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "north" })
      });
      const wire = await readPromise;

      const oracleEnvelope = wire.find(
        (w): w is Extract<SseWireEvent, { event: "turn" }> =>
          w.event === "turn" && w.envelope.kind === "oracle_observation"
      );
      expect(oracleEnvelope).toBeDefined();
      const payload = oracleEnvelope!.envelope.payload as { output?: string };
      expect(payload.output).toBe("INJECTED-ORACLE-OUTPUT");
    } finally {
      await closeServer(server);
    }
  });

  it("propagates process oracle stub output on SSE without changing routes", async () => {
    const coordinator = new RunCoordinator(
      createProcessOracleBridge({ command: process.execPath, args: [oracleStubPath] })
    );
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      const { runId } = (await start.json()) as { runId: string };

      const sseRes = await fetch(`${baseUrl}/runs/${runId}/events`);
      const readPromise = readSseUntilCount(sseRes, 6);
      await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "__PROCESS_ORACLE_LINE__" })
      });
      const wire = await readPromise;

      const oracleEnvelope = wire.find(
        (w): w is Extract<SseWireEvent, { event: "turn" }> =>
          w.event === "turn" && w.envelope.kind === "oracle_observation"
      );
      expect(oracleEnvelope).toBeDefined();
      const payload = oracleEnvelope!.envelope.payload as { output?: string };
      expect(payload.output).toBe("PROCESS-ORACLE-STUB-LINE");
    } finally {
      await closeServer(server);
    }
  });

  it("synthetic oracle respects forceReject", () => {
    const o = createSyntheticOracleBridge();
    expect(o.observe({ runId: "r", turnId: "t", sequence: 1, action: "x", forceReject: true }).rejected).toBe(
      true
    );
  });

  it("GET /runs/:id/checkpoints is empty then lists checkpoint after one turn", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      const { runId } = (await start.json()) as { runId: string };

      const empty = await fetch(`${baseUrl}/runs/${runId}/checkpoints`);
      expect(empty.status).toBe(200);
      const emptyBody = listCheckpointsResponseSchema.parse(await empty.json());
      expect(emptyBody).toEqual([]);

      await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });

      const listed = await fetch(`${baseUrl}/runs/${runId}/checkpoints`);
      expect(listed.status).toBe(200);
      const checkpoints = listCheckpointsResponseSchema.parse(await listed.json());
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0]!.runId).toBe(runId);
      expect(checkpoints[0]!.sequence).toBe(1);
    } finally {
      await closeServer(server);
    }
  });

  it("POST /runs/:id/replay returns restore payload for run checkpoint", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      const { runId } = (await start.json()) as { runId: string };

      await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });

      const listed = await fetch(`${baseUrl}/runs/${runId}/checkpoints`);
      const [{ checkpointId }] = listCheckpointsResponseSchema.parse(await listed.json());

      const replay = await fetch(`${baseUrl}/runs/${runId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postReplayRequestSchema.parse({ checkpointId }))
      });
      expect(replay.status).toBe(200);
      const payload = postReplayResponseSchema.parse(await replay.json());
      expect(payload.checkpointId).toBe(checkpointId);
      expect(payload.runId).toBe(runId);
      expect(payload.controlPhase).toBe("act");
      expect(payload.replayInputRef).toContain(runId);
    } finally {
      await closeServer(server);
    }
  });

  it("POST /runs/:id/replay returns 404 for unknown checkpointId", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const start = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      const { runId } = (await start.json()) as { runId: string };

      const replay = await fetch(`${baseUrl}/runs/${runId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId: "no-such-cp" })
      });
      expect(replay.status).toBe(404);
      const body = (await replay.json()) as { error?: string };
      expect(body.error).toBe("not_found");
    } finally {
      await closeServer(server);
    }
  });

  it("POST /runs/:id/replay returns 404 when checkpoint belongs to another run", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const a = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("SLM") })
      });
      const { runId: runA } = (await a.json()) as { runId: string };
      const b = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: createRunConfig("API") })
      });
      const { runId: runB } = (await b.json()) as { runId: string };

      await fetch(`${baseUrl}/runs/${runA}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });
      const [{ checkpointId }] = listCheckpointsResponseSchema.parse(
        await (await fetch(`${baseUrl}/runs/${runA}/checkpoints`)).json()
      );

      const replay = await fetch(`${baseUrl}/runs/${runB}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId })
      });
      expect(replay.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});
