import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  IssuePairingCodeResponse,
  RedeemPairingCodeResponse,
  RegisteredDevice,
  SessionId,
} from "../../../../packages/contracts/src/session/contract.js";

const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
};

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const randomPairingCode = (length = 6): string => {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PAIRING_CODE_ALPHABET[bytes[i]! % PAIRING_CODE_ALPHABET.length]!;
  }
  return out;
};

export class SessionStore {
  readonly #pairingTtlMs: number;
  readonly #sessions = new Set<SessionId>();
  readonly #pairingCodes = new Map<string, PairingEntry>();
  readonly #devices = new Map<string, DeviceEntry>();

  constructor(options: SessionStoreOptions = {}) {
    this.#pairingTtlMs = options.pairingTtlMs ?? DEFAULT_PAIRING_TTL_MS;
  }

  createSession(): SessionId {
    const sessionId = randomUUID();
    this.#sessions.add(sessionId);
    return sessionId;
  }

  hasSession(sessionId: SessionId): boolean {
    return this.#sessions.has(sessionId);
  }

  issuePairingCode(sessionId: SessionId): IssuePairingCodeResponse {
    if (!this.hasSession(sessionId)) {
      throw new Error("Unknown session");
    }
    const expiresAt = Date.now() + this.#pairingTtlMs;
    let code = randomPairingCode();
    while (this.#pairingCodes.has(code)) {
      code = randomPairingCode();
    }
    this.#pairingCodes.set(code, { code, sessionId, expiresAt, redeemed: false });
    return {
      code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  redeemPairingCode(
    code: string,
    deviceLabel?: string
  ): RedeemPairingCodeResponse | "expired" | "consumed" | "unknown" {
    const entry = this.#pairingCodes.get(code);
    if (!entry) {
      return "unknown";
    }
    if (entry.redeemed) {
      return "consumed";
    }
    if (Date.now() > entry.expiresAt) {
      this.#pairingCodes.delete(code);
      return "expired";
    }

    entry.redeemed = true;
    const deviceId = randomUUID();
    const deviceToken = randomBytes(32).toString("base64url");
    const registeredAt = new Date().toISOString();
    this.#devices.set(deviceId, {
      deviceId,
      sessionId: entry.sessionId,
      deviceLabel,
      registeredAt,
      tokenHash: hashToken(deviceToken),
    });

    return {
      deviceId,
      deviceToken,
      sessionId: entry.sessionId,
    };
  }

  /** Validates a device bearer token; used by future relay WSS auth (I4). */
  validateDeviceToken(deviceToken: string): RegisteredDevice | null {
    const tokenHash = hashToken(deviceToken);
    for (const device of this.#devices.values()) {
      if (device.tokenHash === tokenHash) {
        const { tokenHash: _ignored, ...registered } = device;
        return registered;
      }
    }
    return null;
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
