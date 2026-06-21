import type { IncomingMessage } from "node:http";

/**
 * Comma-separated list of allowed browser `Origin` values. When unset or blank,
 * responses use `Access-Control-Allow-Origin: *`. When set, only matching
 * origins receive a reflected `Access-Control-Allow-Origin`; others omit it.
 */
export const ADV_V2_CORS_ORIGINS_ENV = "ADV_V2_CORS_ORIGINS";

export const parseCorsAllowlist = (): readonly string[] | null => {
  const raw = process.env[ADV_V2_CORS_ORIGINS_ENV];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length === 0 ? null : parts;
};

/** CORS headers for a request; reads `ADV_V2_CORS_ORIGINS` per request for tests and runtime env changes. */
export const corsHeadersForRequest = (req: IncomingMessage): Record<string, string> => {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  const allowlist = parseCorsAllowlist();
  if (allowlist === null) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && allowlist.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base;
};
