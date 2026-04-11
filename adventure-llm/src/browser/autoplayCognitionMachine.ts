import { createMachine } from "xstate";

/**
 * Minimal explicit state machine for browser autoplay cognition (ADR0005).
 */
export const browserAutoplayCognitionMachine = createMachine({
  id: "browserAutoplayCognition",
  initial: "idle",
  states: {
    idle: {
      on: { PROMPT_READY: "awaitingPlan" },
    },
    awaitingPlan: {
      on: {
        PLAN_START: "planning",
        RESET: "idle",
      },
    },
    planning: {
      on: {
        PLAN_DONE: "submitting",
        RESET: "idle",
      },
    },
    submitting: {
      on: {
        GETIN_SENT: "idle",
        RESET: "idle",
      },
    },
  },
});
