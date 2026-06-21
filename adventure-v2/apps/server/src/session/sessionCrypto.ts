import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 hex digest of a high-entropy secret (device bearer token). */
export const hashSecretHex = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

/**
 * Constant-time compare for equal-length hex digests (OWASP: avoid timing leaks on secrets).
 * Returns false when lengths differ without throwing.
 */
export const secureCompareHexDigests = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
};
