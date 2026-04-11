import type { AdventureDatabase } from "./dat/types.js";
import {
  DIAGONAL_COMPASS_MOTION_TOKEN_SET,
  isDiagonalCompassMotionEnabled,
} from "./diagonalCompassMotion.js";

/** Planner / NL may use QUIT even when it is not an ATAB travel word. */
const SYNTHETIC_ENUM_TOKENS = ["QUIT"] as const;

/**
 * All distinct five-character vocabulary entries from `adventure.dat` (ATAB), sorted.
 */
export function collectGameVocabTokens(db: AdventureDatabase): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    const w = db.atab[i].trim();
    if (w.length === 0 || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }
  words.sort((a, b) => a.localeCompare(b));
  return words;
}

/**
 * Token list for language-model JSON enums: game vocabulary plus synthetic planner tokens.
 * Use the same list for primary and secondary so the model cannot invent words;
 * use game token `NULL` (when present in dat) or omit secondary where the API allows.
 */
export function vocabTokensForLlmEnums(db: AdventureDatabase): string[] {
  const set = new Set(collectGameVocabTokens(db));
  for (const t of SYNTHETIC_ENUM_TOKENS) set.add(t);
  if (!isDiagonalCompassMotionEnabled()) {
    for (const d of DIAGONAL_COMPASS_MOTION_TOKEN_SET) set.delete(d);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * OpenAI Chat Completions `response_format.json_schema.schema` (strict) for interpret JSON.
 * Requires nullable fields so every property appears in `required` per OpenAI structured outputs rules.
 */
export function openAiInterpretCommandJsonSchema(
  tokenEnum: readonly string[],
): Record<string, unknown> {
  const e = [...tokenEnum];
  return {
    type: "object",
    properties: {
      primaryToken: { type: "string", enum: e },
      secondaryToken: {
        anyOf: [{ type: "string", enum: e }, { type: "null" }],
      },
      confidence: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
    },
    required: ["primaryToken", "secondaryToken", "confidence"],
    additionalProperties: false,
  };
}

/**
 * OpenAI Chat Completions `response_format.json_schema.schema` (strict) for autoplay planner JSON.
 */
export function openAiAutoplayPlannerJsonSchema(
  tokenEnum: readonly string[],
): Record<string, unknown> {
  const e = [...tokenEnum];
  return {
    type: "object",
    properties: {
      primaryToken: { type: "string", enum: e },
      secondaryToken: {
        anyOf: [{ type: "string", enum: e }, { type: "null" }],
      },
      confidence: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
      continuePlaying: { type: "boolean" },
    },
    required: [
      "primaryToken",
      "secondaryToken",
      "confidence",
      "continuePlaying",
    ],
    additionalProperties: false,
  };
}
