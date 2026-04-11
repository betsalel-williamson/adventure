import type { AdventureDatabase } from "../dat/types.js";
import { appendInteractionLog, readCachedInterpreted } from "./llmDebug.js";
import {
  InterpretedCommandSchema,
  type InterpretedCommand,
} from "@adventure-llm/nl-glue";
import {
  finalizeInterpretedCommand,
  type TextLlmProviderId,
} from "@adventure-llm/nl-glue";

/**
 * If a valid cached raw interpret JSON exists, finalize it (vocab + repair) and log a cache hit.
 */
export async function loadCachedInterpretIfHit(args: {
  readonly cacheDir: string | null;
  readonly cacheKey: string;
  readonly db: AdventureDatabase;
  readonly userText: string;
  readonly recentGameText: string | undefined;
  readonly providerId: TextLlmProviderId;
  readonly modelId: string;
}): Promise<InterpretedCommand | null> {
  if (!args.cacheDir) return null;
  const cached = await readCachedInterpreted(args.cacheDir, args.cacheKey);
  if (!cached) return null;
  const parsed = InterpretedCommandSchema.safeParse(cached);
  if (!parsed.success) return null;
  const repaired = finalizeInterpretedCommand(
    args.db,
    args.userText,
    parsed.data,
    args.recentGameText,
  );
  await appendInteractionLog({
    event: "text_llm_cache_hit",
    provider: args.providerId,
    userText: args.userText,
    model: args.modelId,
    cacheKey: args.cacheKey,
    parsed: parsed.data,
    repaired,
  });
  return repaired;
}
