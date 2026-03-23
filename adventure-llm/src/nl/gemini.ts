import type { InterpretedCommand } from "./schema.js";
import type { AdventureDatabase } from "../dat/types.js";
import { toA5 } from "../vocab/vocab.js";
import { GoogleGenerativeAiTextLlm } from "./providers/googleGenerativeAiTextLlm.js";

export type GeminiInterpreterOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()` (gemini-2.5-flash). */
  model?: string;
  /** Last game transcript since the previous command; improves "them"/"it" and TAKE disambiguation. */
  recentGameText?: string;
};

export { shouldFallbackToClassicForGeminiError } from "./llmErrors.js";
export { buildVocabHint } from "./vocabHint.js";

/**
 * @deprecated Prefer {@link interpretWithTextLlm} with {@link resolveTextLlmFromEnv} or {@link GoogleGenerativeAiTextLlm}.
 * Map natural language to structured tokens using Google Generative AI JSON output.
 */
export async function interpretWithGemini(
  userText: string,
  db: AdventureDatabase,
  options: GeminiInterpreterOptions,
): Promise<InterpretedCommand> {
  const client = new GoogleGenerativeAiTextLlm({
    apiKey: options.apiKey,
    model: options.model,
  });
  return client.interpretPlayerInput(userText, db, {
    recentGameText: options.recentGameText,
  });
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
