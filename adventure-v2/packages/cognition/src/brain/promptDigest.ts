import { createHash } from "node:crypto";

/** Deterministic short digest for trace payloads (SHA-256 hex, first 16 chars). */
export const digestUtf8 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

export const firstLineExcerpt = (text: string, maxChars = 120): string => {
  const line = text.trim().split(/\r?\n/)[0] ?? "";
  return line.length <= maxChars ? line : `${line.slice(0, maxChars)}…`;
};
