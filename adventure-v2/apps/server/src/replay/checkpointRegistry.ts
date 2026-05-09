import type { CheckpointRef, ReplayRestorePayload } from "../../../../packages/contracts/src/index.js";

export class CheckpointRegistry {
  private readonly checkpoints = new Map<string, CheckpointRef>();
  private readonly payloadByCheckpointId = new Map<string, ReplayRestorePayload>();

  save(ref: CheckpointRef, payload: ReplayRestorePayload): void {
    this.checkpoints.set(ref.checkpointId, ref);
    this.payloadByCheckpointId.set(ref.checkpointId, payload);
  }

  get(checkpointId: string): CheckpointRef | undefined {
    return this.checkpoints.get(checkpointId);
  }

  resolve(checkpointId: string): ReplayRestorePayload | undefined {
    return this.payloadByCheckpointId.get(checkpointId);
  }
}

