import { existsSync } from "node:fs";
import type { Server } from "node:http";
import type { Server as HttpsServer } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  dashboardTestOrigin,
  listenDashboardTestServer,
} from "./dashboardTestEnv.js";
import { createAutoplayDashboardServer } from "./webDashboard.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
  "..",
);
const datPath = path.join(repoRoot, "adventure.dat");

const testHttpDashboard = () =>
  createAutoplayDashboardServer({ secureCookies: false });

/** Node fetch does not retain cookies; pass first `Set-Cookie` on subsequent POSTs. */
async function cookieHeader(
  server: Server | HttpsServer,
): Promise<Record<string, string>> {
  const r = await fetch(`${dashboardTestOrigin(server)}/api/session`);
  const raw = r.headers.get("set-cookie");
  if (!raw) return {};
  const pair = raw.split(";")[0]?.trim();
  return pair ? { Cookie: pair } : {};
}

/** TDD: NL routes are thin request/response; engine is separate; output is SSE. */
describe("webDashboard NL / engine HTTP contract", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
  });

  it("POST /api/engine/input rejects natural without interpret on all path aliases", async () => {
    const server = testHttpDashboard();
    await listenDashboardTestServer(server);
    const origin = dashboardTestOrigin(server);
    const headers = {
      "Content-Type": "application/json",
      ...(await cookieHeader(server)),
    };
    const body = JSON.stringify({ natural: "go east" });
    for (const pathname of [
      "/api/engine/input",
      "/api/autoplay-engine-input",
      "/api/manual-command",
    ]) {
      const r = await fetch(`${origin}${pathname}`, {
        method: "POST",
        headers,
        body,
      });
      expect(r.status).toBe(400);
      const j = (await r.json()) as { error?: string };
      expect(j.error).toMatch(/\/api\/nl\/interpret/);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it.runIf(existsSync(datPath))(
    "POST /api/nl/planner matches legacy paths when plannerUserPrompt is missing",
    async () => {
      const server = testHttpDashboard();
      await listenDashboardTestServer(server);
      const origin = dashboardTestOrigin(server);
      const headers = {
        "Content-Type": "application/json",
        ...(await cookieHeader(server)),
      };
      const paths = ["/api/nl/planner", "/api/llm/plan", "/api/autoplay-plan"];
      const first = await fetch(`${origin}${paths[0]}`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const j0 = (await first.json()) as { error?: string };
      expect(first.status).toBe(400);
      expect(j0.error).toBe("Expected plannerUserPrompt");
      for (let i = 1; i < paths.length; i++) {
        const r = await fetch(`${origin}${paths[i]}`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });
        const j = (await r.json()) as { error?: string };
        expect(r.status).toBe(400);
        expect(j.error).toBe("Expected plannerUserPrompt");
      }
      await new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
      });
    },
  );

  it.runIf(existsSync(datPath))(
    "POST /api/nl/interpret matches /api/llm/interpret when natural is missing",
    async () => {
      const server = testHttpDashboard();
      await listenDashboardTestServer(server);
      const origin = dashboardTestOrigin(server);
      const headers = {
        "Content-Type": "application/json",
        ...(await cookieHeader(server)),
      };
      const body = JSON.stringify({});
      for (const pathname of ["/api/nl/interpret", "/api/llm/interpret"]) {
        const r = await fetch(`${origin}${pathname}`, {
          method: "POST",
          headers,
          body,
        });
        expect(r.status).toBe(400);
        const j = (await r.json()) as { error?: string };
        expect(j.error).toBe("Expected { natural: string }");
      }
      await new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
      });
    },
  );

  it.runIf(existsSync(datPath))(
    "POST /api/nl/interpret returns 400 for empty body variants",
    async () => {
      const server = testHttpDashboard();
      await listenDashboardTestServer(server);
      const origin = dashboardTestOrigin(server);
      const headers = {
        "Content-Type": "application/json",
        ...(await cookieHeader(server)),
      };
      for (const rawBody of ["null", JSON.stringify({ natural: "" })]) {
        const r = await fetch(`${origin}/api/nl/interpret`, {
          method: "POST",
          headers,
          body: rawBody === "null" ? "null" : rawBody,
        });
        expect(r.status).toBe(400);
        const j = (await r.json()) as { error?: string };
        expect(j.error).toBe("Expected { natural: string }");
      }
      await new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
      });
    },
  );
});
