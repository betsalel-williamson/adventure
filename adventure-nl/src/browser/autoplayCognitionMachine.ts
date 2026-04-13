import { createMachine } from "xstate";

/**
 * Minimal explicit state machine for browser autoplay cognition (ADR0005).
 *
 * Glue policy runs behind an MCP-shaped boundary (`dispatchGlueMcpJsonRpc` /
 * `GlueMcpWorkerHost` from the cognition bundle); this machine remains the
 * orchestration spine that should sequence engine events, optional Glue `tools/call`
 * steps, and client-direct model phases—not the tools themselves (ADR0016).
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
