import { createHash } from "node:crypto";
import { COGNITION_PROMPT_TEXT_MAX_CHARS } from "../../../contracts/src/http/wire.js";

/** Truncate prompt text before placing on SSE wire (matches {@link COGNITION_PROMPT_TEXT_MAX_CHARS}). */
export const capPromptTextForWire = (
  text: string,
  maxChars: number = COGNITION_PROMPT_TEXT_MAX_CHARS
): string => (text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`);

/** Deterministic short digest for trace payloads (SHA-256 hex, first 16 chars). */
export const digestUtf8 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

export const firstLineExcerpt = (text: string, maxChars = 120): string => {
  const line = text.trim().split(/\r?\n/)[0] ?? "";
  return line.length <= maxChars ? line : `${line.slice(0, maxChars)}…`;
};
