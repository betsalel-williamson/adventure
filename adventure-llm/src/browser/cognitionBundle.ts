/**
 * Browser bundle entry: glue modules for ADR0005 (esbuild → public/generated/browserAutoplayCognition.js).
 */
export {
  deserializeAdventureDatabaseFromJson,
  type AdventureDatabaseJsonV1,
} from "../dat/adventureDatabaseJson.js";
export type { AdventureDatabase } from "../dat/types.js";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikePlayAgainPrompt,
  type AutoplayUiSnapshot,
} from "../nl/autoplaySessionMemory.js";
export { buildAutoplayPlannerInvocation } from "../nl/buildAutoplayPlannerInvocation.js";
export { planAfterAutoplayGuards } from "../nl/autoplayPlannerGuards.js";
export { plannerToScriptedGetin } from "../nl/plannerToScriptedGetin.js";
export {
  resolveAutoplayContextChars,
  paceMsFromOverrides,
  maxMovesFromOverrides,
} from "../nl/autoplayThrottle.js";
export { browserAutoplayCognitionMachine } from "./autoplayCognitionMachine.js";
