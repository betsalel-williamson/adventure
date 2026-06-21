import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssistApp } from "./server.js";

describe("createAssistApp", () => {
  let baseUrl = "";
  let server: Server;

  beforeAll(async () => {
    const app = createAssistApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });

  it("merges transcript on POST /assist/ingest", async () => {
    const res = await fetch(`${baseUrl}/assist/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "ingest-test",
        transcript: "YOU ARE IN HALLWAY.",
        line: "YOU ARE IN HALLWAY.",
        context: { priorLines: [], currentPlaceId: null },
      }),
    });
    expect(res.ok).toBe(true);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ status: "ok" });
    expect(JSON.stringify(body)).toContain("flowchart LR");
  });

  it("does not advance probe when ASSIST_PROBE_ENABLED is false", async () => {
    const res = await fetch(`${baseUrl}/assist/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "probe-off",
        transcript: "YOU ARE IN HALLWAY.",
        advance: true,
      }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      nextMove: string | null;
      notice?: string;
    };
    expect(body.nextMove).toBeNull();
    expect(body.notice).toContain("probe disabled");
  });
});
