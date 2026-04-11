/**
 * Game simulation pipe: Fortran subprocess + parsed `adventure.dat` only.
 *
 * Phase A (ADR0014): this layer does not apply NL/SLM “reactions” (interpret/repair/planner
 * context). Those live in `@adventure-llm/nl-glue` and `src/cognition/`. The HTTP dashboard
 * should treat this surface as the authority boundary for “prompt to engine → game text back”.
 */
export { loadDatFile, loadDatFromString } from "../dat/loadDat.js";
export type { AdventureDatabase, LLineRow } from "../dat/types.js";
export {
  ADVENTURE_DATABASE_JSON_VERSION,
  deserializeAdventureDatabaseFromJson,
  serializeAdventureDatabaseToJson,
  type AdventureDatabaseJsonV1,
} from "../dat/adventureDatabaseJson.js";
export {
  normalizeInstructionsAnswer,
  normalizeTranscript,
  runFortranOpenThenFirstCommand,
  runFortranScript,
  transcriptSuggestsCommandRejected,
  type AwaitingPlayerInputContext,
  type ContinueLineContext,
  type FirstCommandContext,
  type FortranStreamOptions,
  type ScriptedGetinLine,
  type SubprocessEngineOptions,
} from "../engine/subprocessEngine.js";
