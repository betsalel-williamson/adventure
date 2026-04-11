import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertBenchmarkRunRow,
  openBenchmarkRunsDb,
  resetBenchmarkRunsDbSingleton,
} from "./benchmarkRunsDb.js";
import { resetServerSubsystemReplicaStoreSingletonForTests } from "./subsystemServerSync.js";
import { collectHostRuntimeInfo } from "./hostRuntimeInfo.js";
import { readGitWorktreeMeta } from "./gitWorktreeMeta.js";
import { createAutoplayDashboardServer } from "./webDashboard.js";
const packageRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");

const testHttpDashboard = () =>
  createAutoplayDashboardServer({ secureCookies: false });

describe("createAutoplayDashboardServer", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_PROMPT_PROJECTS_DIR;
    delete process.env.ADVENTURE_NL_BENCHMARK_DB;
    delete process.env.ADVENTURE_NL_BENCHMARK_RUNS;
    delete process.env.ADVENTURE_NL_SUBSYSTEM_REPLICA_DIR;
    delete process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
    resetBenchmarkRunsDbSingleton();
    resetServerSubsystemReplicaStoreSingletonForTests();
  });

  it("POST /api/subsystem-sync applies a linear batch (ADR0008)", async () => {
    const replicaDir = mkdtempSync(path.join(tmpdir(), "adv-subrepl-"));
    process.env.ADVENTURE_NL_SUBSYSTEM_REPLICA_DIR = replicaDir;
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const r = await fetch(`http://127.0.0.1:${port}/api/subsystem-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-dashboard-test",
        clientHeadRevisionId: 2,
        revisions: [
          {
            id: 2,
            parentRevisionId: 1,
            createdAtIso: "2026-04-10T12:00:00.000Z",
            fileChanges: [{ path: "note.txt", content: "synced" }],
          },
        ],
      }),
    });
    expect(r.ok).toBe(true);
    const j = (await r.json()) as {
      ok?: boolean;
      sync?: { status?: string; serverHeadRevisionId?: number };
    };
    expect(j.ok).toBe(true);
    expect(j.sync?.status).toBe("applied");
    expect(j.sync?.serverHeadRevisionId).toBe(2);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(replicaDir, { recursive: true, force: true });
  });

  it("GET /api/session reports browserOrchestratedAutoplay true by default (client nl-glue path)", async () => {
    delete process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const r = await fetch(`http://127.0.0.1:${port}/api/session`);
    expect(r.ok).toBe(true);
    const j = (await r.json()) as { browserOrchestratedAutoplay?: boolean };
    expect(j.browserOrchestratedAutoplay).toBe(true);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /api/session respects ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0", async () => {
    process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY = "0";
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const r = await fetch(`http://127.0.0.1:${port}/api/session`);
    expect(r.ok).toBe(true);
    const j = (await r.json()) as { browserOrchestratedAutoplay?: boolean };
    expect(j.browserOrchestratedAutoplay).toBe(false);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it.runIf(existsSync(datPath))(
    "GET /api/adventure-database returns serialized dat",
    async () => {
      const server = testHttpDashboard();
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const addr = server.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : undefined;
      expect(port).toBeDefined();
      const r = await fetch(`http://127.0.0.1:${port}/api/adventure-database`);
      expect(r.ok).toBe(true);
      const j = (await r.json()) as { database: { v: number } };
      expect(j.database.v).toBe(1);
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  );

  it("POST /api/autoplay-engine-input is disabled when browser orchestration is off", async () => {
    process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY = "0";
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const r = await fetch(
      `http://127.0.0.1:${port}/api/autoplay-engine-input`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ getinLine: "east    " }),
      },
    );
    expect(r.status).toBe(404);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /api/text-llm returns backends and shape", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/api/text-llm`);
    expect(res.ok).toBe(true);
    const j = (await res.json()) as {
      current: { providerId: string; modelId: string } | null;
      backends: Array<{
        providerId: string;
        available: boolean;
        presets: string[];
      }>;
      canSwap: boolean;
      packaging: {
        byProvider: Record<
          string,
          {
            providerId: string;
            limits: { ssePromptCapChars: number };
            jsonSchemaByMode: {
              interpret: { wire: string };
              planner: { wire: string };
            };
          }
        >;
      };
    };
    expect(j.backends.length).toBe(3);
    expect(typeof j.canSwap).toBe("boolean");
    expect(j.packaging.byProvider.mlx.providerId).toBe("mlx");
    expect(j.packaging.byProvider.http.providerId).toBe("http");
    expect(j.packaging.byProvider.google.providerId).toBe("google");
    expect(j.packaging.byProvider.mlx.limits.ssePromptCapChars).toBe(200_000);
    expect(
      j.current === null ||
        (typeof j.current.providerId === "string" &&
          typeof j.current.modelId === "string"),
    ).toBe(true);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /api/mlx-model returns presets and shape", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/api/mlx-model`);
    expect(res.ok).toBe(true);
    const j = (await res.json()) as {
      canSwap: boolean;
      modelId: string;
      presets: string[];
    };
    expect(typeof j.canSwap).toBe("boolean");
    expect(Array.isArray(j.presets)).toBe(true);
    expect(j.presets.length).toBeGreaterThan(0);
    expect(typeof j.modelId).toBe("string");
    if (j.canSwap) {
      expect(j.modelId.length).toBeGreaterThan(0);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("POST /api/mlx-model/cancel returns 400 when no swap load is active", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/api/mlx-model/cancel`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("serves index.html at GET /", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("autoplay dashboard");
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /api/parser-verbs returns synonym groups", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/api/parser-verbs`);
    expect(res.ok).toBe(true);
    const j = (await res.json()) as { groups: string[][] };
    expect(Array.isArray(j.groups)).toBe(true);
    expect(j.groups.length).toBeGreaterThan(0);
    const takeLine = j.groups.find((g) => g.includes("TAKE"));
    expect(takeLine).toBeDefined();
    expect(takeLine!.includes("GET")).toBe(true);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET and POST /api/autoplay-settings round-trip", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const base = `http://127.0.0.1:${port}`;
    const g = await fetch(`${base}/api/autoplay-settings`);
    expect(g.ok).toBe(true);
    const j0 = (await g.json()) as { paceMs: number; maxMoves: number };
    expect(typeof j0.paceMs).toBe("number");
    expect(typeof j0.maxMoves).toBe("number");

    const p = await fetch(`${base}/api/autoplay-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paceMs: 100, maxMoves: 42 }),
    });
    expect(p.ok).toBe(true);
    const j1 = (await p.json()) as { paceMs: number; maxMoves: number };
    expect(j1.paceMs).toBe(100);
    expect(j1.maxMoves).toBe(42);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET/PATCH /api/prompt-experiment", async () => {
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const base = `http://127.0.0.1:${port}`;
    const g = await fetch(`${base}/api/prompt-experiment`);
    expect(g.ok).toBe(true);
    const j0 = (await g.json()) as {
      patch: { includeDatHelpInSystem?: boolean };
    };
    expect(j0.patch.includeDatHelpInSystem).not.toBe(false);

    const p = await fetch(`${base}/api/prompt-experiment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemMode: "append", systemText: "x" }),
    });
    expect(p.ok).toBe(true);
    const j1 = (await p.json()) as { patch: { systemMode?: string } };
    expect(j1.patch.systemMode).toBe("append");

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("POST /api/prompt-projects creates file in ADVENTURE_NL_PROMPT_PROJECTS_DIR", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "adv-ppm-"));
    process.env.ADVENTURE_NL_PROMPT_PROJECTS_DIR = dir;
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const base = `http://127.0.0.1:${port}`;
    const c = await fetch(`${base}/api/prompt-projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "T1" }),
    });
    expect(c.status).toBe(201);
    const rec = (await c.json()) as { id: string; schemaVersion: number };
    expect(rec.id.length).toBeGreaterThan(0);
    expect(rec.schemaVersion).toBe(2);

    const li = await fetch(`${base}/api/prompt-projects`);
    expect(li.ok).toBe(true);
    const lj = (await li.json()) as { projects: Array<{ id: string }> };
    expect(lj.projects.some((p) => p.id === rec.id)).toBe(true);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(dir, { recursive: true });
  });

  it("POST /api/prompt-projects/:id/duplicate creates a fork", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "adv-ppm-dup-"));
    process.env.ADVENTURE_NL_PROMPT_PROJECTS_DIR = dir;
    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const base = `http://127.0.0.1:${port}`;
    const c = await fetch(`${base}/api/prompt-projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Orig" }),
    });
    expect(c.status).toBe(201);
    const orig = (await c.json()) as { id: string };
    const d = await fetch(
      `${base}/api/prompt-projects/${encodeURIComponent(orig.id)}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Forked" }),
      },
    );
    expect(d.status).toBe(201);
    const fork = (await d.json()) as { id: string; parentProjectId?: string };
    expect(fork.id).not.toBe(orig.id);
    expect(fork.parentProjectId).toBe(orig.id);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(dir, { recursive: true });
  });

  it("GET /api/benchmark-runs/leaderboard returns inserted rows", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "adv-bench-"));
    process.env.ADVENTURE_NL_BENCHMARK_DB = path.join(dir, "runs.db");
    resetBenchmarkRunsDbSingleton();
    openBenchmarkRunsDb(packageRoot);
    insertBenchmarkRunRow({
      id: "bench-row-1",
      createdAtIso: new Date().toISOString(),
      eventId: null,
      dashboardSessionId: "sess",
      teamName: "alpha",
      projectId: null,
      strategyId: "explore",
      git: readGitWorktreeMeta(repoRoot),
      host: collectHostRuntimeInfo(),
      config: {
        maxMoves: 120,
        paceMs: 0,
        contextChars: 6000,
        providerId: "mlx",
        modelId: "test",
        projectId: null,
        strategyId: "explore",
        eventId: null,
        teamName: "alpha",
        tags: [],
      },
      metrics: {
        moves: 10,
        cellsDiscovered: 7,
        wallTimeMs: 5000,
        plannerMsTotal: 800,
        plannerCalls: 10,
        hitMaxMoves: false,
      },
      status: "completed",
      failureReason: null,
      llmSessionJsonlPath: null,
    });

    const server = testHttpDashboard();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port =
      typeof addr === "object" && addr !== null ? addr.port : undefined;
    expect(port).toBeDefined();
    const res = await fetch(
      `http://127.0.0.1:${port}/api/benchmark-runs/leaderboard?limit=5`,
    );
    expect(res.ok).toBe(true);
    const j = (await res.json()) as {
      runs: Array<{ id: string; cellsDiscovered: number }>;
    };
    expect(j.runs.some((r) => r.id === "bench-row-1")).toBe(true);
    expect(j.runs[0]?.cellsDiscovered).toBe(7);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(dir, { recursive: true });
  });
});
