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

export const createControlMachine = (invalidThreshold = 2): ControlMachine => {
  let phase: ControlPhase = "act";
  let invalidCount = 0;

  const transition = (to: ControlPhase, reason: string, sequence: number): PhaseTransitionEvent => {
    const event: PhaseTransitionEvent = { from: phase, to, reason, sequence, ts: now() };
    phase = to;
    return event;
  };

  return {
    currentPhase: () => phase,
    onOracleObservationDispatched: (sequence) => transition("disorder", "oracle-dispatched", sequence),
    onReconcileOutcome: (sequence, nextPolicy) => {
      if (nextPolicy === "test") {
        return transition("test", "reconcile-nextPolicy-test", sequence);
      }
      if (nextPolicy === "chaos") {
        return transition("chaos", "reconcile-nextPolicy-chaos", sequence);
      }
      invalidCount = 0;
      return transition("act", "reconcile-nextPolicy-continue", sequence);
    },
    onInvalidAction: (sequence) => {
      invalidCount += 1;
      if (invalidCount > invalidThreshold) {
        return transition("chaos", "invalid-threshold-exceeded", sequence);
      }
      return transition("test", "invalid-action", sequence);
    }
  };
};

