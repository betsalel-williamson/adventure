import { describe, expect, it } from "vitest";
import { RunCoordinator } from "../apps/server/src/run/runCoordinator.js";
import { listenAdventureServer } from "../apps/server/src/http/createServer.js";
import { gameTerminalTurnAppendFromWire } from "../apps/web/src/gameTerminalBuffer.js";
import type { SseWireEvent } from "../packages/contracts/src/index.js";
import { closeServer } from "./helpers/closeServer.js";
import { readSseUntilCount } from "./helpers/httpWire.js";
import { createRunConfig } from "./steps/runSteps.js";

/**
 * Automated smoke: one POST /turns yields SSE wire events that map into the same CRT lane
 * rows the dev shell uses (`#game-terminal`). Replaces optional Playwright until E2E stabilizes.
 */
describe("game terminal wire (integration)", () => {
  it("maps one synthetic-oracle turn into proposal, oracle OK., and ignores reconcile wire rows", async () => {
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
      const readPromise = readSseUntilCount(sseRes, 10);

      const turnRes = await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });
      expect(turnRes.status).toBe(204);

      const wire = await readPromise;

      const oracleEv = wire.find(
        (w): w is Extract<SseWireEvent, { event: "turn" }> =>
          w.event === "turn" && w.envelope.kind === "oracle_observation"
      );
      expect(oracleEv).toBeDefined();
      const obsPayload = oracleEv!.envelope.payload as { output?: string };
      expect(obsPayload.output).toBe("OK.");

      const crtLines: string[] = [];
      for (const w of wire) {
        const chunk = gameTerminalTurnAppendFromWire(w);
        if (chunk) {
          crtLines.push(chunk.line);
        }
      }
      expect(crtLines).toContain("[agent] look");
      expect(crtLines).toContain("OK.");
      expect(crtLines.some((l) => l.includes("reconcile"))).toBe(false);
    } finally {
      await closeServer(server);
    }
  });
});
