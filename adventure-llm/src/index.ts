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
  type FirstCommandContext,
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
  AutoplayPlannerResponseSchema,
  interpretedToGetinLine,
  swapInterpretedTokens,
  type InterpretedCommand,
  type AutoplayPlannerResponse,
} from "./nl/schema.js";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikeParserRejection,
  normalizeGetinLineKey,
} from "./nl/autoplaySessionMemory.js";
export {
  collectGameVocabTokens,
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "./nl/gameVocabEnums.js";
export {
  buildAutoplayRelevantTokensFilterPrompt,
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
  parseRelevantTokensResponse,
} from "./nl/situationalCandidates.js";
export {
  ADVENTURE_LLM_INTERPRET_ROLE,
  ADVENTURE_LLM_INTERPRET_ROLE_COMPACT,
  ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE,
  ADVENTURE_LLM_AUTOPLAY_PLANNER_ROLE_COMPACT,
  ADVENTURE_LLM_PARSER_TOKEN_RULES,
  ADVENTURE_LLM_PARSER_TOKEN_RULES_COMPACT,
  ADVENTURE_LLM_INTERPRET_COMPACT_HELP_HINT,
  adventureLlmInterpretJsonFooter,
  adventureLlmAutoplayJsonFooter,
  buildInterpretSystemAndUserPrompt,
  buildAutoplayPlannerPrompt,
  linesForAutoplayPlannerContextBody,
  autoplayPlannerTaskBlockStructured,
  interpretTaskBlockStructured,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
  resolveVocabHintMaxWords,
  MLX_SYSTEM_PROMPT_VARIANTS,
  resolveMlxSystemPromptVariant,
  mlxAutoplayPlannerInstructionsBlock,
  mlxAutoplaySystemPrompt,
  mlxAutoplaySystemPromptForVariant,
  resolveInterpretPromptExamples,
  resolveInterpretPromptBuildOptions,
  type BuildInterpretPromptOptions,
  type MlxSystemPromptVariant,
} from "./nl/adventureNlPrompts.js";
export {
  loadInterpretEvalFixtures,
  buildInterpretEvalExamplesSection,
  type InterpretEvalFixture,
} from "./nl/interpretEvalFixtures.js";
export {
  compareInterpretEval,
  normalizeInterpretEvalToken,
  type InterpretEvalExpect,
  type InterpretEvalComparison,
} from "./nl/interpretEvalMatch.js";
export {
  tryLoadAiVocabCategoriesForHint,
  loadAiVocabCategoriesForHint,
  resolveAiVocabCategoriesPath,
  normalizeVocabToken,
  type AiVocabCategoriesFile,
  type AiVocabCategoryGroup,
  type ResolvedAiVocabGroups,
} from "./nl/vocabAiCategories.js";
export {
  buildVocabAiCategorizationPrompt,
  generateAiVocabCategoriesWithLlm,
} from "./nl/vocabCategoriesGenerate.js";
export { chooseNextMoveWithGemini } from "./nl/geminiAutoplay.js";
export {
  buildVocabHint,
  interpretWithGemini,
  shouldFallbackToClassicForGeminiError,
  validateAgainstVocab,
  type BuildVocabHintOptions,
  type GeminiInterpreterOptions,
} from "./nl/gemini.js";
export type { GeminiAutoplayPlannerOptions } from "./nl/geminiAutoplay.js";
export {
  resolveTextLlmFromEnv,
  createTextLlmFromEnv,
  interpretWithTextLlm,
  planAutoplayWithTextLlm,
  DEFAULT_HTTP_OPENAI_BASE_URL,
  DEFAULT_MLX_MODEL_ID,
} from "./nl/adventureTextLlm.js";
export type {
  InterpretPlayerInputOptions,
  InterpretPromptStyleOverrides,
  PlannerUserPromptInput,
  TextLlm,
  TextLlmProviderId,
} from "./nl/textLlmContract.js";
export { shouldFallbackToClassicForLlmError } from "./nl/llmErrors.js";
export { GoogleGenerativeAiTextLlm } from "./nl/providers/googleGenerativeAiTextLlm.js";
export type { GoogleGenerativeAiTextLlmOptions } from "./nl/providers/googleGenerativeAiTextLlm.js";
export { HttpOpenAiCompatibleTextLlm } from "./nl/providers/httpOpenAiCompatibleTextLlm.js";
export type { HttpOpenAiCompatibleTextLlmOptions } from "./nl/providers/httpOpenAiCompatibleTextLlm.js";
export { MlxLmStdioTextLlm } from "./nl/providers/mlxLmStdioTextLlm.js";
export type { MlxLmStdioTextLlmOptions } from "./nl/providers/mlxLmStdioTextLlm.js";
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
