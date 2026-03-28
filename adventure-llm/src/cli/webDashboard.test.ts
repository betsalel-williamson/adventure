import { describe, expect, it } from "vitest";
import { createAutoplayDashboardServer } from "./webDashboard.js";

describe("createAutoplayDashboardServer", () => {
  it("GET /api/text-llm returns backends and shape", async () => {
    const server = createAutoplayDashboardServer();
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
    };
    expect(j.backends.length).toBe(3);
    expect(typeof j.canSwap).toBe("boolean");
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
    const server = createAutoplayDashboardServer();
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
    if (j.canSwap) {
      expect(j.modelId.length).toBeGreaterThan(0);
    } else {
      expect(j.modelId).toBe("");
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("POST /api/mlx-model/cancel returns 400 when no swap load is active", async () => {
    const server = createAutoplayDashboardServer();
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
    const server = createAutoplayDashboardServer();
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
    const server = createAutoplayDashboardServer();
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
    const server = createAutoplayDashboardServer();
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
});
