import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionResponseSchema,
  issuePairingCodeResponseSchema,
  redeemPairingCodeResponseSchema,
} from "../packages/contracts/src/session/contract.js";
import {
  RunCoordinator,
  SessionStore,
  listenAdventureServer,
} from "../apps/server/src/index.js";
import { closeServer } from "./helpers/closeServer.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const openapiPath = join(repoRoot, "openapi.yaml");

const SESSION_COOKIE = "adv_v2_session";

const parseSetCookie = (header: string | null): Record<string, string> => {
  if (!header) {
    return {};
  }
  const [pair] = header.split(";");
  const eq = pair!.indexOf("=");
  return { [pair!.slice(0, eq)]: pair!.slice(eq + 1) };
};

describe("session auth (S1)", () => {
  afterEach(() => {
    delete process.env.ADV_V2_INSECURE_HTTP;
  });

  it("POST /session creates HttpOnly session cookie", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const res = await fetch(`${baseUrl}/session`, { method: "POST" });
      expect(res.status).toBe(201);
      const body = createSessionResponseSchema.parse(await res.json());
      const cookies = parseSetCookie(res.headers.get("set-cookie"));
      expect(cookies[SESSION_COOKIE]).toBe(body.sessionId);
      expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    } finally {
      await closeServer(server);
    }
  });

  it("POST /inference/plan returns 401 without session", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const res = await fetch(`${baseUrl}/inference/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "550e8400-e29b-41d4-a716-446655440000",
          mode: "planner",
          system: "sys",
          user: "usr",
          schemaMode: "planner",
        }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("unauthorized");
    } finally {
      await closeServer(server);
    }
  });

  it("POST /inference/plan returns 501 stub when session is valid", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const sessionRes = await fetch(`${baseUrl}/session`, { method: "POST" });
      const cookie = sessionRes.headers.get("set-cookie") ?? "";
      const res = await fetch(`${baseUrl}/inference/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie.split(";")[0] ?? "",
        },
        body: JSON.stringify({
          requestId: "550e8400-e29b-41d4-a716-446655440000",
          mode: "planner",
          system: "sys",
          user: "usr",
          schemaMode: "planner",
        }),
      });
      expect(res.status).toBe(501);
    } finally {
      await closeServer(server);
    }
  });

  it("issues pairing code with TTL for authenticated session", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const sessionRes = await fetch(`${baseUrl}/session`, { method: "POST" });
      const cookie = sessionRes.headers.get("set-cookie") ?? "";
      const res = await fetch(`${baseUrl}/pairing/codes`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0] ?? "" },
      });
      expect(res.status).toBe(201);
      const body = issuePairingCodeResponseSchema.parse(await res.json());
      expect(body.code).toMatch(/^[A-Z2-9]{6,8}$/);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    } finally {
      await closeServer(server);
    }
  });

  it("redeems pairing code once and returns device token contract", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore();
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const sessionRes = await fetch(`${baseUrl}/session`, { method: "POST" });
      const sessionBody = createSessionResponseSchema.parse(await sessionRes.json());
      const cookie = sessionRes.headers.get("set-cookie") ?? "";
      const codeRes = await fetch(`${baseUrl}/pairing/codes`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0] ?? "" },
      });
      const { code } = issuePairingCodeResponseSchema.parse(await codeRes.json());

      const redeemRes = await fetch(`${baseUrl}/pairing/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, deviceLabel: "dev-macbook" }),
      });
      expect(redeemRes.status).toBe(200);
      const redeemed = redeemPairingCodeResponseSchema.parse(await redeemRes.json());
      expect(redeemed.sessionId).toBe(sessionBody.sessionId);
      expect(redeemed.deviceToken.length).toBeGreaterThanOrEqual(32);

      const again = await fetch(`${baseUrl}/pairing/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      expect(again.status).toBe(410);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects expired pairing codes", async () => {
    const coordinator = new RunCoordinator();
    const sessions = new SessionStore({ pairingTtlMs: 1 });
    const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
    try {
      const sessionRes = await fetch(`${baseUrl}/session`, { method: "POST" });
      const cookie = sessionRes.headers.get("set-cookie") ?? "";
      const codeRes = await fetch(`${baseUrl}/pairing/codes`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0] ?? "" },
      });
      const { code } = issuePairingCodeResponseSchema.parse(await codeRes.json());
      await new Promise((r) => setTimeout(r, 5));
      const redeemRes = await fetch(`${baseUrl}/pairing/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      expect(redeemRes.status).toBe(410);
    } finally {
      await closeServer(server);
    }
  });

  it("documents session and pairing paths in generated OpenAPI", () => {
    const doc = parseYaml(readFileSync(openapiPath, "utf8")) as {
      paths?: Record<string, unknown>;
    };
    expect(doc.paths).toMatchObject({
      "/session": expect.any(Object),
      "/pairing/codes": expect.any(Object),
      "/pairing/redeem": expect.any(Object),
    });
  });
});
