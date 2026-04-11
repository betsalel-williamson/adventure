export { loadDatFile, loadDatFromString } from "./dat/loadDat.js";
export type { AdventureDatabase, LLineRow } from "@adventure-lm/lm-glue";
export {
  buildMotionGraphFromDat,
  type DatMotionEdge,
} from "./dat/motionGraphFromDat.js";
export { getin, type GetinResult } from "./cli/getin.js";
export { findVocabIndex, ktabK, ktabClass, toA5 } from "@adventure-lm/lm-glue";
export {
  runFortranScript,
  runFortranOpenThenFirstCommand,
  normalizeInstructionsAnswer,
  normalizeTranscript,
  transcriptSuggestsCommandRejected,
  type SubprocessEngineOptions,
  type FortranStreamOptions,
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
} from "@adventure-lm/lm-glue";
export {
  InterpretedCommandSchema,
  AutoplayPlannerResponseSchema,
  interpretedToGetinLine,
  swapInterpretedTokens,
  type InterpretedCommand,
  type AutoplayPlannerResponse,
} from "@adventure-lm/lm-glue";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikeBlockedMove,
  gameOutputLooksLikeParserRejection,
  gameOutputLooksLikePlayAgainPrompt,
  normalizeGetinLineKey,
  type AutoplayUiSnapshot,
  type AutoplayUiTurnSnapshot,
} from "@adventure-lm/lm-glue";
export {
  InferredExplorationMap,
  canonicalExplorationFingerprint,
  classifyRoomFingerprint,
  detectLocationStagnation,
  extractLocationLineForFingerprint,
  fingerprintLocationFromExcerpt,
  fingerprintLocationFromGameOutput,
  graphNodeIdFromCellKey,
  sessionLocationFingerprintFromGameOutput,
  inverseMotionPrimary,
  isGridMotionPrimary,
  isMazeFingerprint,
  MOTION_GRID_DELTA,
  AUTOPLAY_ESCAPE_PRIMARY_ORDER,
  autoplayEscapePrimaryOrder,
  CARDINAL_ESCAPE_PRIMARIES,
  cardinalRotationForCellKey,
  orderedEscapePrimariesForCellKey,
  primaryFromGetinCommand,
  secondaryFromGetinCommand,
  fsmLabelFromGetinCommand,
  graphEdgeLabelFromCommand,
  isBlockedTravelOrExitPrimary,
  isLegitimateGraphEdgePrimary,
  canonicalMotionPrimaryForDedup,
  describeMotionGridDelta,
  type Vec3,
  type ExitOutcomeKind,
  type InferredRoomKind,
  type InferredExplorationMapSnapshot,
  type InferredExplorationCellSnapshot,
  type DirectedEdgeKind,
  type DirectedEdgeSnapshot,
  type TriedCommandSnapshot,
} from "@adventure-lm/lm-glue";
export {
  collectNeighborhoodNodeIds,
  graphNodeCaptionForSnapshot,
  inferredMapToDot,
  inferredMapToLocalDot,
  inferredMapToMermaid,
  shortMermaidPlaceLabelForSnapshot,
} from "@adventure-lm/lm-glue";
export {
  collectGameVocabTokens,
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "@adventure-lm/lm-glue";
export {
  buildAutoplayRelevantTokensFilterPrompt,
  buildSituationalCandidateTokens,
  countVisibleAdventureObjectsInText,
  listVisibleAdventureObjectsInText,
  matchSecondaryToObjectAtabWord,
  formatSituationalCandidatesSection,
  listVisibleRoomObjectsNotCarried,
  shouldPrioritizeLootFunnel,
  parseRelevantTokensResponse,
  recentTextSuggestsGrateDescentNavigation,
  recentTextSuggestsIndoorBuildingNavigation,
  recentTextSuggestsVerticalPassageNavigation,
  stripInjectedCommandLinesForObjectHints,
} from "@adventure-lm/lm-glue";
export {
  ADVENTURE_LM_INTERPRET_ROLE,
  ADVENTURE_LM_INTERPRET_ROLE_COMPACT,
  ADVENTURE_LM_AUTOPLAY_PLANNER_ROLE,
  ADVENTURE_LM_AUTOPLAY_PLANNER_ROLE_COMPACT,
  ADVENTURE_LM_PARSER_TOKEN_RULES,
  ADVENTURE_LM_PARSER_TOKEN_RULES_COMPACT,
  ADVENTURE_LM_AUTOPLAY_RULES_SLM,
  ADVENTURE_LM_AUTOPLAY_LOOT_FUNNEL_SYSTEM_SLM,
  ADVENTURE_LM_INTERPRET_COMPACT_HELP_HINT,
  adventureLlmInterpretJsonFooter,
  adventureLlmAutoplayJsonFooter,
  buildInterpretSystemAndUserPrompt,
  buildAutoplayPlannerPrompt,
  effectivePlannerSendPayload,
  linesForAutoplayPlannerContextBody,
  autoplayPlannerTaskBlockStructured,
  interpretTaskBlockStructured,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
  resolveVocabHintMaxWords,
  resolveFastInterpretPrompt,
  recentGameTextSliceForInterpretPrompt,
  recentGameCharsCapForInterpret,
  MLX_SYSTEM_PROMPT_VARIANTS,
  resolveMlxSystemPromptVariant,
  mlxAutoplayPlannerInstructionsBlock,
  mlxAutoplaySystemPrompt,
  mlxAutoplaySystemPromptForVariant,
  resolveAutoplayPromptMode,
  resolveInterpretPromptExamples,
  resolveInterpretPromptBuildOptions,
  type AutoplayPromptMode,
  type AutoplayPlannerBuildOptions,
  type BuildInterpretPromptOptions,
  type MlxSystemPromptVariant,
} from "@adventure-lm/lm-glue";
export {
  LLM_PACKAGING_AUTOPLAY_RECENT_RAW_TAIL_MAX_CHARS,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_COMPACT,
  LLM_PACKAGING_INTERPRET_RECENT_GAME_CHARS_FULL,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_SYSTEM_CHARS,
  LLM_PACKAGING_PLANNER_PREVIEW_MAX_USER_CHARS,
  LLM_PACKAGING_SSE_PROMPT_CAP_CHARS,
} from "@adventure-lm/lm-glue";
export {
  buildLlmPackagingDiscoveryPayload,
  type LlmJsonSchemaWireKind,
  type LlmPackagingDiscoveryPayload,
  type LlmPackagingProfile,
  type LlmSchemaModeId,
} from "./nl/llmPackagingProfile.js";
export {
  applyPlannerPromptExperiment,
  defaultPromptExperimentPatch,
  patchPromptExperimentPatch,
  type PromptExperimentModelNotesTarget,
  type PromptExperimentPatch,
  type PromptExperimentSystemMode,
} from "@adventure-lm/lm-glue";
export {
  loadInterpretEvalFixtures,
  buildInterpretEvalExamplesSection,
  type InterpretEvalFixture,
} from "@adventure-lm/lm-glue";
export {
  compareInterpretEval,
  normalizeInterpretEvalToken,
  type InterpretEvalExpect,
  type InterpretEvalComparison,
} from "@adventure-lm/lm-glue";
export {
  tryLoadAiVocabCategoriesForHint,
  loadAiVocabCategoriesForHint,
  resolveAiVocabCategoriesPath,
  normalizeVocabToken,
  type AiVocabCategoriesFile,
  type AiVocabCategoryGroup,
  type ResolvedAiVocabGroups,
} from "@adventure-lm/lm-glue";
export {
  buildVocabAiCategorizationPrompt,
  generateAiVocabCategoriesWithLlm,
} from "@adventure-lm/lm-glue";
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
  createMlxTextLlmFromEnv,
  mlxLmOptionsFromEnv,
  interpretWithTextLlm,
  planAutoplayWithTextLlm,
  DEFAULT_HTTP_OPENAI_BASE_URL,
  DEFAULT_MLX_MODEL_ID,
} from "./nl/adventureTextLlm.js";
export {
  runAutoplaySessionWithTextLlm,
  plannerToScriptedGetin,
  formatPlannerPromptPreviews,
  syntheticPlannerResponseFromScripted,
  resolveAutoplayPaceMs,
  DEFAULT_AUTOPLAY_MAX_MOVES,
  resolveAutoplayMaxMoves,
  resolveAutoplayContextChars,
  resolveAutoplayInstructionsAnswer,
  AUTOPLAY_RESUME_PLANNER,
  type AutoplayUiSink,
  type AutoplayRunPaths,
  type AutoplayRunOverrides,
  type AutoplayManualPlannerGate,
  type TextLlmSource,
} from "./cli/autoplayRunner.js";
export { createAutoplayDashboardServer } from "./cli/webDashboard.js";
export type {
  InterpretPlayerInputOptions,
  InterpretPromptStyleOverrides,
  PlannerUserPromptInput,
  TextLlm,
  TextLlmProviderId,
} from "@adventure-lm/lm-glue";
export { shouldFallbackToClassicForLlmError } from "./nl/llmErrors.js";
export { GoogleGenerativeAiTextLlm } from "./nl/providers/googleGenerativeAiTextLlm.js";
export type { GoogleGenerativeAiTextLlmOptions } from "./nl/providers/googleGenerativeAiTextLlm.js";
export { HttpOpenAiCompatibleTextLlm } from "./nl/providers/httpOpenAiCompatibleTextLlm.js";
export type { HttpOpenAiCompatibleTextLlmOptions } from "./nl/providers/httpOpenAiCompatibleTextLlm.js";
export { MlxLmStdioTextLlm } from "./nl/providers/mlxLmStdioTextLlm.js";
export type { MlxLmStdioTextLlmOptions } from "./nl/providers/mlxLmStdioTextLlm.js";
export { instructionIntentToHelpCommand } from "@adventure-lm/lm-glue";
export {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  resolvedGeminiTextModel,
  resolvedGeminiImageModel,
} from "./nl/geminiModels.js";
export {
  appendInteractionLog,
  cacheKeyFor,
  interpretCacheSchemaVersion,
  DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION,
  interpretCacheKeyMaterialHash,
  resolveDebugLogPath,
  resolveCacheDir,
  sanitizeInteractionLogRecord,
} from "./nl/llmDebug.js";
export { interpretCacheKeyFromBuildOptions } from "./nl/interpretCacheKey.js";
export {
  LlmTransportError,
  httpStatusEligibleForRetry,
  isLlmTransportError,
} from "./nl/llmErrors.js";
export {
  locationImageCacheKey,
  getOrCreateLocationImage,
  saveLocationImage,
  type LocationImageOptions,
} from "./images/locationImages.js";
