/**
 * Browser bundle entry: glue modules for ADR0005 (esbuild → public/generated/browserAutoplayCognition.js).
 */
export {
  deserializeAdventureDatabaseFromJson,
  type AdventureDatabaseJsonV1,
} from "../dat/adventureDatabaseJson.js";
export type { AdventureDatabase } from "@adventure-nl/nl-glue";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikePlayAgainPrompt,
  type AutoplayUiSnapshot,
} from "@adventure-nl/nl-glue";
export { buildAutoplayPlannerInvocation } from "@adventure-nl/nl-glue";
export { planAfterAutoplayGuards } from "@adventure-nl/nl-glue";
export { plannerToScriptedGetin } from "@adventure-nl/nl-glue";
export {
  resolveAutoplayContextChars,
  paceMsFromOverrides,
  maxMovesFromOverrides,
} from "../nl/autoplayThrottle.js";
export { browserAutoplayCognitionMachine } from "./autoplayCognitionMachine.js";
