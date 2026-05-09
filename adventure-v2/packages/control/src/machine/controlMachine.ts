import { assign, createActor, createMachine } from "xstate";

export type ControlPhase = "act" | "think" | "test" | "chaos" | "disorder";
export type NextPolicy = "continue" | "test" | "chaos";

export type PhaseTransitionEvent = {
  from: ControlPhase;
  to: ControlPhase;
  reason: string;
  sequence: number;
  ts: string;
};

export type ControlMachine = {
  currentPhase: () => ControlPhase;
  onOracleObservationDispatched: (sequence: number) => PhaseTransitionEvent;
  onReconcileOutcome: (sequence: number, nextPolicy: NextPolicy) => PhaseTransitionEvent;
  onInvalidAction: (sequence: number) => PhaseTransitionEvent;
};

const now = (): string => new Date().toISOString();

type ControlEvent =
  | { type: "ORACLE_DISPATCHED"; sequence: number }
  | { type: "RECONCILE"; nextPolicy: NextPolicy; sequence: number }
  | { type: "INVALID"; sequence: number };

export const createControlMachineLogic = (invalidThreshold: number) =>
  createMachine({
    types: {} as {
      context: { invalidCount: number; invalidThreshold: number };
      events: ControlEvent;
    },
    context: { invalidCount: 0, invalidThreshold },
    initial: "act",
    states: {
      act: {
        on: { ORACLE_DISPATCHED: "disorder" }
      },
      think: {
        on: { ORACLE_DISPATCHED: "disorder" }
      },
      test: {
        on: { ORACLE_DISPATCHED: "disorder" }
      },
      chaos: {
        on: { ORACLE_DISPATCHED: "disorder" }
      },
      disorder: {
        on: {
          RECONCILE: [
            {
              guard: ({ event }) => event.nextPolicy === "continue",
              target: "act",
              actions: assign({ invalidCount: 0 })
            },
            {
              guard: ({ event }) => event.nextPolicy === "test",
              target: "test"
            },
            {
              guard: ({ event }) => event.nextPolicy === "chaos",
              target: "chaos"
            }
          ],
          INVALID: {
            actions: assign({
              invalidCount: ({ context }) => context.invalidCount + 1
            }),
            target: "invalidRouting"
          }
        }
      },
      invalidRouting: {
        always: [
          {
            guard: ({ context }) => context.invalidCount > context.invalidThreshold,
            target: "chaos"
          },
          { target: "test" }
        ]
      }
    }
  });

export const createControlMachine = (invalidThreshold = 2): ControlMachine => {
  const actor = createActor(createControlMachineLogic(invalidThreshold));
  actor.start();

  return {
    currentPhase: () => actor.getSnapshot().value as ControlPhase,
    onOracleObservationDispatched: (sequence) => {
      const from = actor.getSnapshot().value as ControlPhase;
      actor.send({ type: "ORACLE_DISPATCHED", sequence });
      const to = actor.getSnapshot().value as ControlPhase;
      return { from, to, reason: "oracle-dispatched", sequence, ts: now() };
    },
    onReconcileOutcome: (sequence, nextPolicy) => {
      const from = actor.getSnapshot().value as ControlPhase;
      actor.send({ type: "RECONCILE", nextPolicy, sequence });
      const to = actor.getSnapshot().value as ControlPhase;
      const reason =
        nextPolicy === "continue"
          ? "reconcile-nextPolicy-continue"
          : nextPolicy === "test"
            ? "reconcile-nextPolicy-test"
            : "reconcile-nextPolicy-chaos";
      return { from, to, reason, sequence, ts: now() };
    },
    onInvalidAction: (sequence) => {
      const from = actor.getSnapshot().value as ControlPhase;
      actor.send({ type: "INVALID", sequence });
      const to = actor.getSnapshot().value as ControlPhase;
      const ctx = actor.getSnapshot().context;
      const reason =
        ctx.invalidCount > ctx.invalidThreshold ? "invalid-threshold-exceeded" : "invalid-action";
      return { from, to, reason, sequence, ts: now() };
    }
  };
};
