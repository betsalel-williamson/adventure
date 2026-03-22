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
  isDebugVerbose,
  readCachedInterpreted,
  resolveCacheDir,
  writeCachedInterpreted,
} from "./llmDebug.js";

export type GeminiInterpreterOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()` (gemini-2.5-flash). */
  model?: string;
};

function buildVocabHint(db: AdventureDatabase, maxWords: number): string {
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
        await appendInteractionLog({
          event: "gemini_cache_hit",
          userText,
          model: modelId,
          cacheKey,
          parsed: parsed.data,
        });
        return parsed.data;
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
  const prompt = `You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).
${helpBlock}Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.`;

  await appendInteractionLog({
    event: "gemini_request",
    userText,
    model: modelId,
    promptLength: prompt.length,
    ...(isDebugVerbose() ? { prompt } : {}),
  });

  const startedMs = Date.now();
  const res = await model.generateContent(prompt);
  const durationMs = Date.now() - startedMs;
  const text = res.response.text();
  const parsed = JSON.parse(text) as unknown;
  const cmd = InterpretedCommandSchema.parse(parsed);

  await appendInteractionLog({
    event: "gemini_response",
    userText,
    model: modelId,
    cached: false,
    durationMs,
    rawJson: text,
    parsed: cmd,
  });

  if (cacheDir) {
    await writeCachedInterpreted(cacheDir, cacheKey, cmd);
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
