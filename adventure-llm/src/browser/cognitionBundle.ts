/**
 * Browser bundle entry: glue modules for ADR0005 (esbuild → public/generated/browserAutoplayCognition.js).
 */
export {
  deserializeAdventureDatabaseFromJson,
  type AdventureDatabaseJsonV1,
} from "../dat/adventureDatabaseJson.js";
export type { AdventureDatabase } from "@adventure-llm/nl-glue";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikePlayAgainPrompt,
  type AutoplayUiSnapshot,
} from "@adventure-llm/nl-glue";
export { buildAutoplayPlannerInvocation } from "@adventure-llm/nl-glue";
export { planAfterAutoplayGuards } from "@adventure-llm/nl-glue";
export { plannerToScriptedGetin } from "@adventure-llm/nl-glue";
export {
  resolveAutoplayContextChars,
  paceMsFromOverrides,
  maxMovesFromOverrides,
} from "../nl/autoplayThrottle.js";
export { browserAutoplayCognitionMachine } from "./autoplayCognitionMachine.js";
