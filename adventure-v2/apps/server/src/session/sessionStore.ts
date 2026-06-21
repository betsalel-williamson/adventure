import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type {
  IssuePairingCodeResponse,
  RedeemPairingCodeResponse,
  RegisteredDevice,
  SessionId,
} from "../../../../packages/contracts/src/session/contract.js";
import { hashSecretHex, secureCompareHexDigests } from "./sessionCrypto.js";

export const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
/** Idle timeout: drop session + pairing + devices if no activity (default 10 min). */
export const DEFAULT_SESSION_IDLE_TTL_MS = 10 * 60 * 1000;
export const MIN_SESSION_IDLE_TTL_MS = 5 * 60 * 1000;
export const ADV_V2_SESSION_IDLE_TTL_MS_ENV = "ADV_V2_SESSION_IDLE_TTL_MS";

const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DUMMY_TOKEN_HASH = hashSecretHex("__adventure_v2_session_store_dummy__");

type PairingEntry = {
  code: string;
  sessionId: SessionId;
  expiresAt: number;
  redeemed: boolean;
};

type DeviceEntry = RegisteredDevice & {
  tokenHash: string;
};

export type SessionStoreOptions = {
  pairingTtlMs?: number;
  sessionIdleTtlMs?: number;
  /** Test hook: shorten codes to demonstrate brute-force class in red-team tests. */
  pairingCodeLength?: number;
};

export const resolveSessionIdleTtlMs = (): number => {
  const raw = process.env[ADV_V2_SESSION_IDLE_TTL_MS_ENV];
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_SESSION_IDLE_TTL_MS) {
      return parsed;
    }
  }
  return DEFAULT_SESSION_IDLE_TTL_MS;
};

const randomPairingCode = (length: number): string => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)]!;
  }
  return out;
};

export class SessionStore {
  readonly #pairingTtlMs: number;
  readonly #sessionIdleTtlMs: number;
  readonly #pairingCodeLength: number;
  readonly #sessions = new Map<SessionId, number>();
  readonly #pairingCodes = new Map<string, PairingEntry>();
  readonly #devicesById = new Map<string, DeviceEntry>();
  readonly #devicesByTokenHash = new Map<string, DeviceEntry>();

  constructor(options: SessionStoreOptions = {}) {
    this.#pairingTtlMs = options.pairingTtlMs ?? DEFAULT_PAIRING_TTL_MS;
    this.#sessionIdleTtlMs = options.sessionIdleTtlMs ?? resolveSessionIdleTtlMs();
    this.#pairingCodeLength = options.pairingCodeLength ?? 6;
  }

  /** Drop idle sessions and revoke their pairing codes and registered devices. */
  purgeExpiredSessions(now: number = Date.now()): void {
    for (const [sessionId, lastActivityAt] of this.#sessions) {
      if (now - lastActivityAt > this.#sessionIdleTtlMs) {
        this.revokeSession(sessionId);
      }
    }
  }

  revokeSession(sessionId: SessionId): void {
    this.#sessions.delete(sessionId);
    for (const [code, entry] of this.#pairingCodes) {
      if (entry.sessionId === sessionId) {
        this.#pairingCodes.delete(code);
      }
    }
    for (const [deviceId, device] of this.#devicesById) {
      if (device.sessionId === sessionId) {
        this.#devicesById.delete(deviceId);
        this.#devicesByTokenHash.delete(device.tokenHash);
      }
    }
  }

  createSession(now: number = Date.now()): SessionId {
    this.purgeExpiredSessions(now);
    const sessionId = randomUUID();
    this.#sessions.set(sessionId, now);
    return sessionId;
  }

  /** Returns true when session exists and idle TTL has not elapsed. */
  isSessionActive(
    sessionId: SessionId,
    now: number = Date.now(),
    refreshActivity: boolean = false
  ): boolean {
    this.purgeExpiredSessions(now);
    const lastActivityAt = this.#sessions.get(sessionId);
    if (lastActivityAt === undefined) {
      return false;
    }
    if (now - lastActivityAt > this.#sessionIdleTtlMs) {
      this.revokeSession(sessionId);
      return false;
    }
    if (refreshActivity) {
      this.#sessions.set(sessionId, now);
    }
    return true;
  }

  /** Browser-authenticated routes: validate session and refresh idle TTL. */
  requireActiveSession(sessionId: SessionId, now: number = Date.now()): boolean {
    return this.isSessionActive(sessionId, now, true);
  }

  issuePairingCode(sessionId: SessionId, now: number = Date.now()): IssuePairingCodeResponse {
    if (!this.requireActiveSession(sessionId, now)) {
      throw new Error("Unknown session");
    }
    const expiresAt = now + this.#pairingTtlMs;
    let code = randomPairingCode(this.#pairingCodeLength);
    while (this.#pairingCodes.has(code)) {
      code = randomPairingCode(this.#pairingCodeLength);
    }
    this.#pairingCodes.set(code, { code, sessionId, expiresAt, redeemed: false });
    return {
      code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  redeemPairingCode(
    code: string,
    deviceLabel?: string,
    now: number = Date.now()
  ): RedeemPairingCodeResponse | "expired" | "consumed" | "unknown" {
    this.purgeExpiredSessions(now);
    const entry = this.#pairingCodes.get(code);
    if (!entry) {
      return "unknown";
    }
    if (!this.#sessions.has(entry.sessionId)) {
      this.#pairingCodes.delete(code);
      return "unknown";
    }
    if (entry.redeemed) {
      return "consumed";
    }
    if (now > entry.expiresAt) {
      this.#pairingCodes.delete(code);
      return "expired";
    }
    if (!this.requireActiveSession(entry.sessionId, now)) {
      this.#pairingCodes.delete(code);
      return "unknown";
    }

    entry.redeemed = true;
    const deviceId = randomUUID();
    const deviceToken = randomBytes(32).toString("base64url");
    const registeredAt = new Date(now).toISOString();
    const tokenHash = hashSecretHex(deviceToken);
    const device: DeviceEntry = {
      deviceId,
      sessionId: entry.sessionId,
      deviceLabel,
      registeredAt,
      tokenHash,
    };
    this.#devicesById.set(deviceId, device);
    this.#devicesByTokenHash.set(tokenHash, device);

    return {
      deviceId,
      deviceToken,
      sessionId: entry.sessionId,
    };
  }

  /** Validates a device bearer token; used by future relay WSS auth (I4). */
  validateDeviceToken(deviceToken: string, now: number = Date.now()): RegisteredDevice | null {
    this.purgeExpiredSessions(now);
    const tokenHash = hashSecretHex(deviceToken);
    const device = this.#devicesByTokenHash.get(tokenHash);
    const compareTarget = device?.tokenHash ?? DUMMY_TOKEN_HASH;
    if (!secureCompareHexDigests(tokenHash, compareTarget) || !device) {
      return null;
    }
    if (!this.isSessionActive(device.sessionId, now, false)) {
      return null;
    }
    const { tokenHash: _ignored, ...registered } = device;
    return registered;
  }
}

export const SESSION_COOKIE_NAME = "adv_v2_session";
export const ADV_V2_INSECURE_HTTP_ENV = "ADV_V2_INSECURE_HTTP";

export const sessionCookieFlags = (): string => {
  const insecure = process.env[ADV_V2_INSECURE_HTTP_ENV] === "1";
  const secure = insecure ? "" : "; Secure";
  return `HttpOnly${secure}; SameSite=Lax; Path=/`;
};

export const formatSessionCookie = (sessionId: SessionId): string =>
  `${SESSION_COOKIE_NAME}=${sessionId}; ${sessionCookieFlags()}`;

export const parseSessionCookie = (cookieHeader: string | undefined): SessionId | null => {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const value = part.slice(SESSION_COOKIE_NAME.length + 1);
      return value.length > 0 ? (value as SessionId) : null;
    }
  }
  return null;
};
