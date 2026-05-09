import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listCheckpointsResponseSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  type SseWireEvent
} from "../packages/contracts/src/index.js";
import {
  ADV_V2_CORS_ORIGINS_ENV,
  HTTP_MAX_JSON_BODY_BYTES,
  RunCoordinator,
  createProcessOracleBridge,
  createSyntheticOracleBridge,
  listenAdventureServer,
  type OracleBridge
} from "../apps/server/src/index.js";
import { closeServer } from "./helpers/closeServer.js";
import { readSseUntilCount } from "./helpers/httpWire.js";
import { oracleStubPath } from "./fixturePaths.js";
import { createRunConfig } from "./steps/runSteps.js";

describe("HTTP API + SSE", () => {
  describe("CORS allowlist (ADV_V2_CORS_ORIGINS)", () => {
    let previousOrigins: string | undefined;

    beforeEach(() => {
      previousOrigins = process.env[ADV_V2_CORS_ORIGINS_ENV];
    });

    afterEach(() => {
      if (previousOrigins === undefined) {
        delete process.env[ADV_V2_CORS_ORIGINS_ENV];
      } else {
        process.env[ADV_V2_CORS_ORIGINS_ENV] = previousOrigins;
      }
    });

    it("uses Access-Control-Allow-Origin * when env is unset", async () => {
      delete process.env[ADV_V2_CORS_ORIGINS_ENV];
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.headers.get("access-control-allow-origin")).toBe("*");
      } finally {
        await closeServer(server);
      }
    });

    it("reflects allowed Origin when allowlist is set", async () => {
      process.env[ADV_V2_CORS_ORIGINS_ENV] = "https://app.example";
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const res = await fetch(`${baseUrl}/health`, {
          headers: { Origin: "https://app.example" }
        });
        expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example");
      } finally {
        await closeServer(server);
      }
    });

    it("omits Access-Control-Allow-Origin when Origin is not in the allowlist", async () => {
      process.env[ADV_V2_CORS_ORIGINS_ENV] = "https://app.example";
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const res = await fetch(`${baseUrl}/health`, {
          headers: { Origin: "https://evil.example" }
        });
        expect(res.headers.get("access-control-allow-origin")).toBeNull();
      } finally {
        await closeServer(server);
      }
    });

    it("accepts multiple origins from a comma-separated allowlist", async () => {
      process.env[ADV_V2_CORS_ORIGINS_ENV] = "https://a.example, https://b.example ";
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const a = await fetch(`${baseUrl}/health`, {
          headers: { Origin: "https://a.example" }
        });
        expect(a.headers.get("access-control-allow-origin")).toBe("https://a.example");
        const b = await fetch(`${baseUrl}/health`, {
          headers: { Origin: "https://b.example" }
        });
        expect(b.headers.get("access-control-allow-origin")).toBe("https://b.example");
      } finally {
        await closeServer(server);
      }
    });

    it("OPTIONS preflight uses the same CORS policy as GET", async () => {
      process.env[ADV_V2_CORS_ORIGINS_ENV] = "https://app.example";
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const ok = await fetch(`${baseUrl}/runs`, {
          method: "OPTIONS",
          headers: {
            Origin: "https://app.example",
            "Access-Control-Request-Method": "POST"
          }
        });
        expect(ok.status).toBe(204);
        expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example");

        const denied = await fetch(`${baseUrl}/runs`, {
          method: "OPTIONS",
          headers: {
            Origin: "https://other.example",
            "Access-Control-Request-Method": "POST"
          }
        });
        expect(denied.status).toBe(204);
        expect(denied.headers.get("access-control-allow-origin")).toBeNull();
      } finally {
        await closeServer(server);
      }
    });
  });

  it("GET /health returns liveness JSON without touching run state", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        status?: string;
        service?: string;
        oracleMode?: string;
        processOracleScript?: string | null;
      };
      expect(body.status).toBe("ok");
      expect(body.service).toBe("adventure-v2");
      expect(body.oracleMode).toBe("synthetic");
      expect(body.processOracleScript).toBeNull();
    } finally {
      await closeServer(server);
    }
  });

  it("GET /health reports process oracle when ADV_V2_PROCESS_ORACLE_SCRIPT is set", async () => {
    const envKey = "ADV_V2_PROCESS_ORACLE_SCRIPT";
    const previous = process.env[envKey];
    process.env[envKey] = "/some/path/oracle-fortran-bridge.mjs";
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        oracleMode?: string;
        processOracleScript?: string | null;
      };
      expect(body.oracleMode).toBe("process");
      expect(body.processOracleScript).toBe("oracle-fortran-bridge.mjs");
    } finally {
      await closeServer(server);
      if (previous === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = previous;
      }
    }
  });

  it("POST /runs returns 413 when JSON body exceeds configured byte limit", async () => {
    const coordinator = new RunCoordinator();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
    try {
      const pad = "x".repeat(HTTP_MAX_JSON_BODY_BYTES + 64);
      const body = JSON.stringify({ config: createRunConfig("SLM"), _oversized: pad });
      expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(HTTP_MAX_JSON_BODY_BYTES);

      const res = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      expect(res.status).toBe(413);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toBe("payload_too_large");
    } finally {
      await closeServer(server);
    }
  });

  it("includes R3 reconcile visibility fields on the SSE turn envelope", async () => {
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
      const readPromise = readSseUntilCount(sseRes, 10);

      await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });

      const wire = await readPromise;
      const reconcileEv = wire.find(
        (w): w is Extract<SseWireEvent, { event: "turn" }> =>
          w.event === "turn" && w.envelope.kind === "reconcile"
      );
      expect(reconcileEv).toBeDefined();
      const payload = reconcileEv!.envelope.payload as {
        correlationId?: string;
        driftSummary?: string;
        evidence?: { oracleOutcome?: string };
      };
      expect(payload.correlationId).toBe(`${runId}:turn:1`);
      expect(payload.evidence?.oracleOutcome).toBe("accepted");
      expect(payload.driftSummary).toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });

  it("streams two sequential POST /turns with distinct turn sequences on SSE", async () => {
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

      const eventsPerTurn = 10;
      const readPromise = readSseUntilCount(sseRes, eventsPerTurn * 2, 15_000);

      const turn1 = await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "look" })
      });
      expect(turn1.status).toBe(204);

      const turn2 = await fetch(`${baseUrl}/runs/${runId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "north" })
      });
      expect(turn2.status).toBe(204);

      const wire = await readPromise;

      const proposals = wire.filter(
        (w): w is Extract<SseWireEvent, { event: "turn" }> =>
          w.event === "turn" && w.envelope.kind === "proposal"
      );
      expect(proposals).toHaveLength(2);
      expect(proposals[0]!.envelope.sequence).toBe(1);
      expect(proposals[1]!.envelope.sequence).toBe(2);

      const proposalActions = proposals.map((p) => (p.envelope.payload as { action?: string }).action);
      expect(proposalActions).toEqual(["look", "north"]);
    } finally {
      await closeServer(server);
    }
  });

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

      const readPromise = readSseUntilCount(sseRes, 10);

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

      const traceNodes = wire
        .filter((w): w is Extract<SseWireEvent, { event: "trace" }> => w.event === "trace")
        .map((w) => w.trace.nodeId);
      expect(traceNodes).toEqual(["perceive", "plan", "act", "reconcile"]);
      const planTrace = wire.find(
        (w): w is Extract<SseWireEvent, { event: "trace" }> =>
          w.event === "trace" && w.trace.nodeId === "plan"
      );
      expect(planTrace).toBeDefined();
      expect(planTrace!.trace.promptDigest).toMatch(/^[a-f0-9]{16}$/);
      expect(planTrace!.trace.runId).toBe(runId);
      expect(planTrace!.trace.promptSystem).toContain("Adventure v2 agent");
      expect(planTrace!.trace.promptUser).toContain("look");
    } finally {
      await closeServer(server);
    }
  });

  it("uses injected oracle output on the wire without changing route shape", async () => {
    const customOracle: OracleBridge = {
      observe: () => ({ rejected: false, output: "INJECTED-ORACLE-OUTPUT", outcome: "accepted" })
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

  it("R5: repeated rejected turns escalate control phases through test toward chaos on SSE", async () => {
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

      const eventsPerTurn = 10;
      const turns = 3;
      const readPromise = readSseUntilCount(sseRes, eventsPerTurn * turns, 15_000);

      for (const input of ["bad-action-1", "bad-action-2", "bad-action-3"]) {
        const turn = await fetch(`${baseUrl}/runs/${runId}/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, forceReject: true })
        });
        expect(turn.status).toBe(204);
      }

      const wire = await readPromise;

      const phaseTos = wire
        .filter((w): w is Extract<SseWireEvent, { event: "phase" }> => w.event === "phase")
        .map((w) => w.transition.to);
      expect(phaseTos).toContain("test");
      expect(phaseTos).toContain("chaos");
    } finally {
      await closeServer(server);
    }
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
