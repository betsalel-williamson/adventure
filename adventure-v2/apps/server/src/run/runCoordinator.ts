import type {
  CheckpointRef,
  CognitionTraceWire,
  ReplayRestorePayload,
  RunConfig,
  TurnEnvelope
} from "../../../../packages/contracts/src/index.js";
import { buildReconcileTrace, classifyReconcile, runTurnBrainGraph } from "../../../../packages/cognition/src/index.js";
import { createControlMachine } from "../../../../packages/control/src/index.js";
import type { ControlPhase, PhaseTransitionEvent } from "../../../../packages/control/src/index.js";
import { CheckpointRegistry } from "../replay/checkpointRegistry.js";
import type { OracleBridge } from "../oracle/oracleBridge.js";
import { createSyntheticOracleBridge, normalizeOracleObservation } from "../oracle/oracleBridge.js";
import type { WireStreamItem } from "../http/wireStream.js";

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
  private readonly oracle: OracleBridge;
  private readonly streamListeners = new Map<string, Set<(item: WireStreamItem) => void>>();

  constructor(oracle: OracleBridge = createSyntheticOracleBridge()) {
    this.oracle = oracle;
  }

  /**
   * Subscribe to turn envelopes and phase transitions emitted during a run (for SSE fanout).
   */
  subscribeToRun(runId: string, listener: (item: WireStreamItem) => void): () => void {
    let set = this.streamListeners.get(runId);
    if (!set) {
      set = new Set();
      this.streamListeners.set(runId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this.streamListeners.delete(runId);
      }
    };
  }

  private emitStream(runId: string, item: WireStreamItem): void {
    const set = this.streamListeners.get(runId);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(item);
    }
  }

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

  async processTurn(runId: string, input: string, options: TurnOptions = {}): Promise<TurnResult> {
    const run = this.requireRun(runId);
    const control = this.requireControl(runId);
    const sequence = run.nextSequence;
    const turnId = turnIdFor(runId, sequence);

    const brain = await runTurnBrainGraph({
      runId,
      turnId,
      sequence,
      rawInput: input
    });

    const proposal: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "cognition",
      kind: "proposal",
      ts: now(),
      payload: { action: brain.action }
    };
    run.events.push(proposal);
    this.emitStream(runId, { type: "turn", envelope: proposal });

    for (const trace of brain.traces) {
      this.emitStream(runId, { type: "trace", trace });
    }

    const obs = normalizeOracleObservation(
      await Promise.resolve(
        this.oracle.observe({
          runId,
          turnId,
          sequence,
          action: brain.action,
          forceReject: options.forceReject
        })
      )
    );
    const observation: TurnEnvelope = {
      runId,
      turnId,
      sequence,
      source: "oracle",
      kind: "oracle_observation",
      ts: now(),
      payload: {
        rejected: obs.rejected,
        output: obs.output,
        outcome: obs.outcome,
        ...(obs.stderrExcerpt !== undefined ? { stderrExcerpt: obs.stderrExcerpt } : {})
      }
    };
    run.events.push(observation);
    this.emitStream(runId, { type: "turn", envelope: observation });

    const disorderTransition = control.onOracleObservationDispatched(sequence);
    run.phaseTransitions.push(disorderTransition);
    this.emitStream(runId, { type: "phase", transition: disorderTransition });

    const reconcile = classifyReconcile({
      runId,
      turnId,
      sequence,
      observation: obs
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
    this.emitStream(runId, { type: "turn", envelope: reconcileEvent });

    const reconcileTrace: CognitionTraceWire = buildReconcileTrace({
      runId,
      turnId,
      sequence,
      reconcile
    });
    this.emitStream(runId, { type: "trace", trace: reconcileTrace });

    const policyTransition = obs.rejected
      ? control.onInvalidAction(sequence)
      : control.onReconcileOutcome(sequence, reconcile.nextPolicy);
    run.phaseTransitions.push(policyTransition);
    run.controlPhase = policyTransition.to;
    this.emitStream(runId, { type: "phase", transition: policyTransition });

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
    this.emitStream(runId, { type: "turn", envelope: checkpointEvent });

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
