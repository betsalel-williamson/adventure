/**
 * HTTP session cookie helpers for the autoplay web dashboard (per-browser client id).
 */
import type http from "node:http";

/** Cookie name for the opaque dashboard session id (UUID v4). */
export const ADVENTURE_SESSION_COOKIE = "adventure_session";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && UUID_V4_RE.test(id);
}

/**
 * Parse `Cookie` header and return the adventure session value, or null if missing.
 */
export function parseAdventureSessionCookie(
  cookieHeader: string | undefined,
): string | null {
  if (cookieHeader === undefined || cookieHeader === "") return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${ADVENTURE_SESSION_COOKIE}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      const raw = p.slice(prefix.length).trim();
      if (raw === "") return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export type SessionCookieOptions = {
  readonly secure: boolean;
};

/**
 * Build a single `Set-Cookie` header value (name=value + attributes).
 */
/** Exported for SSE `writeHead` (single Set-Cookie line). */
export function formatSessionSetCookie(
  sessionId: string,
  opts: SessionCookieOptions,
): string {
  const attrs = [
    `${ADVENTURE_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure) attrs.push("Secure");
  return attrs.join("; ");
}

/**
 * Append `Set-Cookie` for a new or refreshed session (merges with existing Set-Cookie if any).
 */
export function appendSessionSetCookieHeader(
  res: http.ServerResponse,
  sessionId: string,
  opts: SessionCookieOptions,
): void {
  const line = formatSessionSetCookie(sessionId, opts);
  const prev = res.getHeader("Set-Cookie");
  if (prev === undefined) {
    res.setHeader("Set-Cookie", line);
  } else if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, line]);
  } else {
    res.setHeader("Set-Cookie", [String(prev), line]);
  }
}
