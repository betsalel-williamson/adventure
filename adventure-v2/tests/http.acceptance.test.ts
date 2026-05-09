import { describe, expect, it } from "vitest";
import { sseWireEventSchema, type SseWireEvent } from "../packages/contracts/src/index.js";
import {
  RunCoordinator,
  createSyntheticOracleBridge,
  listenAdventureServer,
  type OracleBridge
} from "../apps/server/src/index.js";
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

      const readPromise = readSseUntilCount(sseRes, 6);

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
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
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
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("synthetic oracle respects forceReject", () => {
    const o = createSyntheticOracleBridge();
    expect(o.observe({ runId: "r", turnId: "t", sequence: 1, action: "x", forceReject: true }).rejected).toBe(
      true
    );
  });
});
