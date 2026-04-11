/**
 * Phase A (ADR0014): natural-language glue (`@adventure-nl/nl-glue`) — vocab, text,
 * interpret/situational helpers, schema. **NL** = **natural language** (player text
 * and prompt shaping toward GETIN tokens), not a geography abbreviation.
 */
export type { AdventureDatabase, LLineRow } from "./dat/types.js";
export { findVocabIndex, ktabK, ktabClass, toA5 } from "./vocab/vocab.js";
export {
  buildVerbSynonymGroups,
  type VerbSynonymGroup,
} from "./vocab/verbSynonymGroups.js";
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
} from "./schema.js";
export {
  DIAGONAL_COMPASS_MOTION_TOKENS,
  DIAGONAL_COMPASS_MOTION_TOKEN_SET,
  isDiagonalCompassMotionEnabled,
} from "./diagonalCompassMotion.js";
export {
  collectGameVocabTokens,
  openAiAutoplayPlannerJsonSchema,
  openAiInterpretCommandJsonSchema,
  vocabTokensForLlmEnums,
} from "./gameVocabEnums.js";
export {
  compareInterpretEval,
  normalizeInterpretEvalToken,
  type InterpretEvalExpect,
  type InterpretEvalComparison,
} from "./interpretEvalMatch.js";
export { repairInterpretedCommand } from "./repairInterpreted.js";
export {
  buildAutoplayRelevantTokensFilterPrompt,
  buildSituationalCandidateTokens,
  countVisibleAdventureObjectsInText,
  formatSituationalCandidatesSection,
  listVisibleAdventureObjectsInText,
  listVisibleRoomObjectsNotCarried,
  matchSecondaryToObjectAtabWord,
  parseRelevantTokensResponse,
  recentTextSuggestsGrateDescentNavigation,
  recentTextSuggestsIndoorBuildingNavigation,
  recentTextSuggestsVerticalPassageNavigation,
  shouldPrioritizeLootFunnel,
  stripInjectedCommandLinesForObjectHints,
  type FormatSituationalCandidatesOptions,
} from "./situationalCandidates.js";
export {
  AI_VOCAB_FILE_SCHEMA_VERSION,
  aiVocabFileSchema,
  formatAiGroupedVocabularyHint,
  loadAiVocabCategoriesForHint,
  normalizeVocabToken,
  pickWordsFromAiGroups,
  resolveAiVocabCategoriesPath,
  tryLoadAiVocabCategoriesForHint,
  type AiVocabCategoriesFile,
  type AiVocabCategoryGroup,
  type ResolvedAiVocabGroups,
} from "./vocabAiCategories.js";
export { buildVocabHint, type BuildVocabHintOptions } from "./vocabHint.js";
export * from "./llmPackagingConstants.js";
export * from "./scriptedGetinLine.js";
export * from "./textLlmContract.js";
export * from "./promptExperiment.js";
export * from "./jsonFromLlmText.js";
export * from "./coerceLlmJson.js";
export * from "./coerceToVocab.js";
export * from "./intent.js";
export * from "./interpretEvalFixtures.js";
export * from "./adventureNlPrompts.js";
export * from "./inferredExplorationMap.js";
export * from "./explorationGraphViz.js";
export * from "./buildAutoplayPlannerInvocation.js";
export * from "./autoplayPlannerGuards.js";
export * from "./plannerToScriptedGetin.js";
export * from "./autoplaySessionMemory.js";
export * from "./textLlmInterpretPipeline.js";
export * from "./vocabCategoriesGenerate.js";
