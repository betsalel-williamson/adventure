import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { InterpretedCommandSchema, type InterpretedCommand } from "./schema.js";
import type { AdventureDatabase } from "../dat/types.js";
import {
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "../text/speak.js";
import { toA5 } from "../vocab/vocab.js";
import { resolvedGeminiTextModel } from "./geminiModels.js";
import {
  appendInteractionLog,
  cacheKeyFor,
  readCachedInterpreted,
  resolveCacheDir,
  writeCachedInterpreted,
} from "./llmDebug.js";
import { repairInterpretedCommand } from "./repairInterpreted.js";

export type GeminiInterpreterOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()` (gemini-2.5-flash). */
  model?: string;
  /** Last game transcript since the previous command; improves "them"/"it" and TAKE disambiguation. */
  recentGameText?: string;
};

/** True when the CLI should stop using Gemini and run the Fortran binary in classic (TTY) mode. */
export function shouldFallbackToClassicForGeminiError(err: unknown): boolean {
  if (err === null || err === undefined) return false;
  if (typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === "number") {
      if (s === 429 || s === 500 || s === 502 || s === 503) return true;
      if (s === 401 || s === 403) return true;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /429|quota|rate limit|too many requests|resource_exhausted|unavailable|overloaded/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

/** Words from adventure.dat ATAB for NL / autoplay prompts (cap list length for context size). */
export function buildVocabHint(
  db: AdventureDatabase,
  maxWords: number,
): string {
  const words: string[] = [];
  for (let i = 1; i < 1000 && words.length < maxWords; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    words.push(db.atab[i].trim());
  }
  return words.join(", ");
}

/**
 * Map natural language to structured tokens using Gemini JSON output.
 * Caller supplies API key; failures throw.
 */
export async function interpretWithGemini(
  userText: string,
  db: AdventureDatabase,
  options: GeminiInterpreterOptions,
): Promise<InterpretedCommand> {
  const modelId = options.model ?? resolvedGeminiTextModel();
  const cacheDir = resolveCacheDir();
  const cacheKey = cacheKeyFor(userText, modelId);

  if (cacheDir) {
    const cached = await readCachedInterpreted(cacheDir, cacheKey);
    if (cached) {
      const parsed = InterpretedCommandSchema.safeParse(cached);
      if (parsed.success) {
        const repaired = repairInterpretedCommand(
          userText,
          parsed.data,
          options.recentGameText,
        );
        await appendInteractionLog({
          event: "gemini_cache_hit",
          userText,
          model: modelId,
          cacheKey,
          parsed: parsed.data,
          repaired,
        });
        return repaired;
      }
    }
  }

  process.stderr.write("adventure-llm: translating with Gemini…\n");

  const gen = new GoogleGenerativeAI(options.apiKey);
  const model = gen.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          primaryToken: {
            type: SchemaType.STRING,
            description: "Up to 5 chars, uppercase",
          },
          secondaryToken: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["primaryToken"],
      },
    },
  });

  const hint = buildVocabHint(db, 120);
  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    helpFromDat.length > 0
      ? `Official in-game HELP text (from adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}, for when the user asks for instructions or hints):\n${helpFromDat}\n\n`
      : "";
  const recentBlock =
    options.recentGameText && options.recentGameText.trim().length > 0
      ? `Recent game output (use this to resolve "it", "them", and implied objects; prefer nouns that appear here):\n---\n${options.recentGameText.trim().slice(-2500)}\n---\n\n`
      : "";
  const prompt = `You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).
${helpBlock}${recentBlock}Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.
Put the verb in primaryToken and the object or direction in secondaryToken when both apply.
Rules: (1) For taking or carrying something, use primaryToken TAKE or GET and put the object in secondaryToken — never put the object alone in primaryToken. (2) The word UP in column 1 alone means GO UP (a direction), NOT the phrasal verb in "pick it up" / "pick them up"; those mean TAKE + object. (3) For picking up items, prefer TAKE or GET over TOUCH (TOUCH often yields an unhelpful game response). (4) Do not use NULL or placeholder secondaries.`;

  await appendInteractionLog({
    event: "gemini_request",
    userText,
    model: modelId,
    promptLength: prompt.length,
    prompt,
  });

  const startedMs = Date.now();
  const res = await model.generateContent(prompt);
  const durationMs = Date.now() - startedMs;
  const text = res.response.text();
  const parsed = JSON.parse(text) as unknown;
  const rawCmd = InterpretedCommandSchema.parse(parsed);
  const cmd = repairInterpretedCommand(
    userText,
    rawCmd,
    options.recentGameText,
  );

  await appendInteractionLog({
    event: "gemini_response",
    userText,
    model: modelId,
    cached: false,
    durationMs,
    rawJson: text,
    parsed: rawCmd,
    repaired: cmd,
  });

  if (cacheDir) {
    await writeCachedInterpreted(cacheDir, cacheKey, rawCmd);
  }

  return cmd;
}

/** Validate interpreted tokens against ATAB (five-char match). */
export function validateAgainstVocab(
  db: AdventureDatabase,
  cmd: InterpretedCommand,
): boolean {
  const p = toA5(cmd.primaryToken);
  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    if (db.atab[i] === p) return true;
  }
  return false;
}
