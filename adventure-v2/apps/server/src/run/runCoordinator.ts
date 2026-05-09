import type {
  CheckpointRef,
  ReplayRestorePayload,
  RunConfig,
  TurnEnvelope
} from "../../../../packages/contracts/src/index.js";
import { classifyReconcile } from "../../../../packages/cognition/src/index.js";
import { createControlMachine } from "../../../../packages/control/src/index.js";
import type { ControlPhase, PhaseTransitionEvent } from "../../../../packages/control/src/index.js";
import { CheckpointRegistry } from "../replay/checkpointRegistry.js";

type RunState = {
  runId: string;
  threadId: string;
  config: RunConfig;
  nextSequence: number;
  controlPhase: ControlPhase;
  events: TurnEnvelope[];
  phaseTransitions: PhaseTransitionEvent[];
  checkpoints: CheckpointRef[];
};

type TurnOptions = {
  forceReject?: boolean;
};

type TurnResult = {
  checkpoint: CheckpointRef;
  reconcile: ReturnType<typeof classifyReconcile>;
  phaseTransitions: PhaseTransitionEvent[];
};

const now = (): string => new Date().toISOString();
const turnIdFor = (runId: string, sequence: number): string => `${runId}:turn:${sequence}`;
const checkpointIdFor = (runId: string, sequence: number): string => `${runId}:checkpoint:${sequence}`;

export class RunCoordinator {
  private readonly runs = new Map<string, RunState>();
  private readonly controlByRunId = new Map<string, ReturnType<typeof createControlMachine>>();
  private readonly registry = new CheckpointRegistry();

  startRun(config: RunConfig): { runId: string; config: RunConfig } {
    const runId = `run-${this.runs.size + 1}`;
    const threadId = `${runId}:thread:1`;
    const runState: RunState = {
      runId,
      threadId,
      config,
      nextSequence: 1,
      controlPhase: "act",
      events: [],
      phaseTransitions: [],
      checkpoints: []
    };

    this.runs.set(runId, runState);
    this.controlByRunId.set(runId, createControlMachine());
    return { runId, config };
  }

  runMetadata(runId: string): { runId: string; config: RunConfig } {
    const run = this.requireRun(runId);
    return { runId: run.runId, config: run.config };
  }

  processTurn(runId: string, input: string, options: TurnOptions = {}): TurnResult {
    const run = this.requireRun(runId);
    const control = this.requireControl(runId);
    const sequence = run.nextSequence;
    const turnId = turnIdFor(runId, sequence);
    const rejected = Boolean(options.forceReject);

    const proposal: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "cognition",
      kind: "proposal",
      ts: now(),
      payload: { action: input }
    };
    run.events.push(proposal);

    const observation: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "oracle",
      kind: "oracle_observation",
      ts: now(),
      payload: { rejected, output: rejected ? "I do not understand that." : "OK." }
    };
    run.events.push(observation);

    const disorderTransition = control.onOracleObservationDispatched(sequence);
    run.phaseTransitions.push(disorderTransition);

    const reconcile = classifyReconcile({
      runId,
      turnId,
      sequence,
      oracleRejected: rejected
    });
    const reconcileEvent: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "cognition",
      kind: "reconcile",
      ts: now(),
      payload: reconcile
    };
    run.events.push(reconcileEvent);

    const policyTransition = rejected
      ? control.onInvalidAction(sequence)
      : control.onReconcileOutcome(sequence, reconcile.nextPolicy);
    run.phaseTransitions.push(policyTransition);
    run.controlPhase = policyTransition.to;

    const checkpoint: CheckpointRef = {
      checkpointId: checkpointIdFor(runId, sequence),
      runId,
      threadId: run.threadId,
      turnId,
      sequence,
      replayInputRef: `${runId}:replay-input:${sequence}`,
      createdAt: now()
    };
    run.checkpoints.push(checkpoint);

    const checkpointEvent: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "control",
      kind: "checkpoint",
      ts: now(),
      payload: checkpoint
    };
    run.events.push(checkpointEvent);

    const restorePayload: ReplayRestorePayload = {
      checkpointId: checkpoint.checkpointId,
      runId,
      sequence,
      replayInputRef: checkpoint.replayInputRef,
      controlPhase: run.controlPhase,
      pendingOracleSequence: run.controlPhase === "disorder" ? sequence : null,
      restoredAt: now()
    };
    this.registry.save(checkpoint, restorePayload);

    run.nextSequence += 1;
    return {
      checkpoint,
      reconcile,
      phaseTransitions: [disorderTransition, policyTransition]
    };
  }

  replay(checkpointId: string): ReplayRestorePayload {
    const payload = this.registry.resolve(checkpointId);
    if (!payload) {
      throw new Error(`Unknown checkpoint: ${checkpointId}`);
    }
    return payload;
  }

  eventsForRun(runId: string): TurnEnvelope[] {
    return [...this.requireRun(runId).events];
  }

  transitionsForRun(runId: string): PhaseTransitionEvent[] {
    return [...this.requireRun(runId).phaseTransitions];
  }

  checkpointsForRun(runId: string): CheckpointRef[] {
    return [...this.requireRun(runId).checkpoints];
  }

  private requireRun(runId: string): RunState {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }
    return run;
  }

  private requireControl(runId: string): ReturnType<typeof createControlMachine> {
    const machine = this.controlByRunId.get(runId);
    if (!machine) {
      throw new Error(`Missing control machine for run: ${runId}`);
    }
    return machine;
  }
}

