/**
 * Browser bundle entry: glue modules for ADR0005 (esbuild → public/generated/browserAutoplayCognition.js).
 */
export {
  deserializeAdventureDatabaseFromJson,
  type AdventureDatabaseJsonV1,
} from "../dat/adventureDatabaseJson.js";
export type { AdventureDatabase } from "@adventure-lm/lm-glue";
export {
  AutoplaySessionMemory,
  gameOutputLooksLikePlayAgainPrompt,
  type AutoplayUiSnapshot,
} from "@adventure-lm/lm-glue";
export { buildAutoplayPlannerInvocation } from "@adventure-lm/lm-glue";
export { planAfterAutoplayGuards } from "@adventure-lm/lm-glue";
export { plannerToScriptedGetin } from "@adventure-lm/lm-glue";
export {
  resolveAutoplayContextChars,
  paceMsFromOverrides,
  maxMovesFromOverrides,
} from "../nl/autoplayThrottle.js";
export { browserAutoplayCognitionMachine } from "./autoplayCognitionMachine.js";
