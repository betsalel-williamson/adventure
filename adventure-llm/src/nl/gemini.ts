import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { InterpretedCommandSchema, type InterpretedCommand } from "./schema.js";
import type { AdventureDatabase } from "../dat/types.js";
import { toA5 } from "../vocab/vocab.js";

export type GeminiInterpreterOptions = {
  apiKey: string;
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
  const gen = new GoogleGenerativeAI(options.apiKey);
  const model = gen.getGenerativeModel({
    model: options.model ?? "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          primaryToken: { type: SchemaType.STRING, description: "Up to 5 chars, uppercase" },
          secondaryToken: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["primaryToken"],
      },
    },
  });

  const hint = buildVocabHint(db, 120);
  const prompt = `You are mapping user input to Colossal Cave Adventure parser tokens (max 5 letters each, like the original game).
Valid vocabulary words include: ${hint}
User said: ${userText}
Reply ONLY with JSON matching the schema. Use words from the list when possible.`;

  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const parsed = JSON.parse(text) as unknown;
  return InterpretedCommandSchema.parse(parsed);
}

/** Validate interpreted tokens against ATAB (five-char match). */
export function validateAgainstVocab(db: AdventureDatabase, cmd: InterpretedCommand): boolean {
  const p = toA5(cmd.primaryToken);
  for (let i = 1; i < 1000; i++) {
    if (db.ktab[i] === 0 && db.atab[i].trim() === "") break;
    if (db.ktab[i] === -1) break;
    if (db.atab[i] === p) return true;
  }
  return false;
}
