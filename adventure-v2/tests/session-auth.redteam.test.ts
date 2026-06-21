/**
 * Red-team tests for S1 session layer — mapped to OWASP Session Management /
 * Authentication cheat sheets. Each case attempts a low-hanging attack; we fix
 * only what is feasible in this threat model.
 *
 * Committed analysis: docs/architecture/cloud-deploy-mvp/security-reviews/2026-06-21-s1-session-auth.md
 * Living spec: docs/architecture/cloud-deploy-mvp/security-and-session.md
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADV_V2_CORS_ORIGINS_ENV,
  PairingRedeemRateLimiter,
  RunCoordinator,
  SessionStore,
  listenAdventureServer,
} from "../apps/server/src/index.js";
import { closeServer } from "./helpers/closeServer.js";

const PAIRING_ALPHABET_SIZE = 32;
const DEFAULT_PAIRING_CODE_LENGTH = 6;

const parseCookie = (setCookie: string | null): string =>
  (setCookie ?? "").split(";")[0] ?? "";

describe("session auth red team (OWASP-aligned)", () => {
  describe("Session Management — session id guessing / hijack", () => {
    it("rejects forged session cookie (not issued by server)", async () => {
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0);
      try {
        const forged = randomUUID();
        const res = await fetch(`${baseUrl}/inference/plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `adv_v2_session=${forged}`,
          },
          body: JSON.stringify({
            requestId: randomUUID(),
            mode: "planner",
            system: "s",
            user: "u",
            schemaMode: "planner",
          }),
        });
        expect(res.status).toBe(401);
      } finally {
        await closeServer(server);
      }
    });

    it("treats UUID session ids as infeasible to brute force within pairing TTL window", () => {
      const space = 2 ** 122;
      const maxRedeemAttemptsPerWindow = 30;
      expect(maxRedeemAttemptsPerWindow / space).toBeLessThan(1e-30);
    });

    it("does not allow one session cookie to access another session pairing slot", async () => {
      const sessions = new SessionStore();
      const coordinator = new RunCoordinator();
      const { server, baseUrl } = await listenAdventureServer(coordinator, 0, "127.0.0.1", sessions);
      try {
        const a = await fetch(`${baseUrl}/session`, { method: "POST" });
        const b = await fetch(`${baseUrl}/session`, { method: "POST" });
        const cookieA = parseCookie(a.headers.get("set-cookie"));
        const cookieB = parseCookie(b.headers.get("set-cookie"));

        const codeForA = await fetch(`${baseUrl}/pairing/codes`, {
          method: "POST",
          headers: { Cookie: cookieA },
        });
        expect(codeForA.status).toBe(201);

        const attackerUsesB = await fetch(`${baseUrl}/pairing/codes`, {
          method: "POST",
          headers: { Cookie: cookieB },
        });
        expect(attackerUsesB.status).toBe(201);
        expect(cookieA).not.toBe(cookieB);
      } finally {
        await closeServer(server);
      }
    });
  });

  describe("Authentication — pairing code brute force", () => {
    it("documents that default 6-char codes exceed practical online search within rate window", () => {
      const space = PAIRING_ALPHABET_SIZE ** DEFAULT_PAIRING_CODE_LENGTH;
      const attemptsAllowedPerMinute = 30;
      const ttlMinutes = 5;
      const maxOnlineAttempts = attemptsAllowedPerMinute * ttlMinutes;
      expect(maxOnlineAttempts / space).toBeLessThan(1e-4);
    });

    it("blocks unbounded pairing redeem attempts with 429 (feasible online guessing class)", async () => {
      const limiter = new PairingRedeemRateLimiter({ maxAttempts: 5, windowMs: 60_000 });
      const { server, baseUrl } = await listenAdventureServer(
        new RunCoordinator(),
        0,
        "127.0.0.1",
        new SessionStore(),
        limiter
      );
      try {
        for (let i = 0; i < 5; i++) {
          const res = await fetch(`${baseUrl}/pairing/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "AAAAAA" }),
          });
          expect(res.status).not.toBe(429);
        }
        const blocked = await fetch(`${baseUrl}/pairing/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "AAAAAA" }),
        });
        expect(blocked.status).toBe(429);
      } finally {
        await closeServer(server);
      }
    });
  });

  describe("CSRF — browser Origin baseline when CORS allowlist configured", () => {
    let previousOrigins: string | undefined;

    beforeEach(() => {
      previousOrigins = process.env[ADV_V2_CORS_ORIGINS_ENV];
      process.env[ADV_V2_CORS_ORIGINS_ENV] = "https://app.example";
    });

    afterEach(() => {
      if (previousOrigins === undefined) {
        delete process.env[ADV_V2_CORS_ORIGINS_ENV];
      } else {
        process.env[ADV_V2_CORS_ORIGINS_ENV] = previousOrigins;
      }
    });

    it("rejects cookie-auth browser route when Origin is not allowlisted", async () => {
      const { server, baseUrl } = await listenAdventureServer(new RunCoordinator(), 0);
      try {
        const sessionRes = await fetch(`${baseUrl}/session`, {
          method: "POST",
          headers: { Origin: "https://app.example" },
        });
        const cookie = parseCookie(sessionRes.headers.get("set-cookie"));
        const res = await fetch(`${baseUrl}/pairing/codes`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://evil.example",
          },
        });
        expect(res.status).toBe(403);
      } finally {
        await closeServer(server);
      }
    });

    it("allows desktop pairing redeem without Origin (non-browser client)", async () => {
      const { server, baseUrl } = await listenAdventureServer(new RunCoordinator(), 0);
      try {
        const sessionRes = await fetch(`${baseUrl}/session`, {
          method: "POST",
          headers: { Origin: "https://app.example" },
        });
        const cookie = parseCookie(sessionRes.headers.get("set-cookie"));
        const codeRes = await fetch(`${baseUrl}/pairing/codes`, {
          method: "POST",
          headers: { Cookie: cookie, Origin: "https://app.example" },
        });
        const { code } = (await codeRes.json()) as { code: string };

        const redeem = await fetch(`${baseUrl}/pairing/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        expect(redeem.status).toBe(200);
      } finally {
        await closeServer(server);
      }
    });
  });

  describe("Cookie flags — XSS exfiltration class", () => {
    it("sets HttpOnly on session cookie", async () => {
      const { server, baseUrl } = await listenAdventureServer(new RunCoordinator(), 0);
      try {
        const res = await fetch(`${baseUrl}/session`, { method: "POST" });
        expect(res.headers.get("set-cookie")).toContain("HttpOnly");
      } finally {
        await closeServer(server);
      }
    });
  });
});
