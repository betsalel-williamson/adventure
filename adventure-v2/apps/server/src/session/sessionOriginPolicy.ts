import type { IncomingMessage, ServerResponse } from "node:http";
import { ADV_V2_CORS_ORIGINS_ENV, parseCorsAllowlist } from "../http/corsPolicy.js";

export { ADV_V2_CORS_ORIGINS_ENV, parseCorsAllowlist };

type SendJson = (
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
) => void;

/**
 * Browser-origin CSRF baseline (adventure-v2 security-and-ops): when CORS allowlist is
 * configured, cookie-auth browser routes require a matching Origin header.
 * Desktop pairing redeem is exempt (no browser Origin).
 */
export const requireAllowedBrowserOrigin = (
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson
): boolean => {
  const allowlist = parseCorsAllowlist();
  if (allowlist === null) {
    return true;
  }
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !allowlist.includes(origin)) {
    sendJson(req, res, 403, {
      error: "forbidden",
      message: "Origin not allowed for cookie-auth request"
    });
    return false;
  }
  return true;
};
