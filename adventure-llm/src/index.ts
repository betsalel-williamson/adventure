export { loadDatFile, loadDatFromString } from "./dat/loadDat.js";
export type { AdventureDatabase, LLineRow } from "./dat/types.js";
export { getin, type GetinResult } from "./cli/getin.js";
export { findVocabIndex, ktabK, ktabClass, toA5 } from "./vocab/vocab.js";
export {
  runFortranScript,
  runFortranOpenThenFirstCommand,
  normalizeInstructionsAnswer,
  normalizeTranscript,
  transcriptSuggestsCommandRejected,
  type SubprocessEngineOptions,
  type ScriptedGetinLine,
  type ContinueLineContext,
} from "./engine/subprocessEngine.js";
export {
  FortranOracleEngine,
  createOracleEngine,
} from "./engine/nativeEngine.js";
export * as Constants from "./engine/constants.js";
export {
  formatLLineRow,
  walkLLineChain,
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "./text/speak.js";
export {
  InterpretedCommandSchema,
  interpretedToGetinLine,
  swapInterpretedTokens,
  type InterpretedCommand,
} from "./nl/schema.js";
export {
  interpretWithGemini,
  shouldFallbackToClassicForGeminiError,
  validateAgainstVocab,
  type GeminiInterpreterOptions,
} from "./nl/gemini.js";
export { instructionIntentToHelpCommand } from "./nl/intent.js";
export {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  resolvedGeminiTextModel,
  resolvedGeminiImageModel,
} from "./nl/geminiModels.js";
export {
  appendInteractionLog,
  cacheKeyFor,
  resolveCacheDir,
  resolveDebugLogPath,
} from "./nl/llmDebug.js";
export {
  locationImageCacheKey,
  getOrCreateLocationImage,
  saveLocationImage,
  type LocationImageOptions,
} from "./images/locationImages.js";
