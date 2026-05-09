/**
 * Typed fetch helpers for checkpoint listing (shared by shell panels and bootstrap).
 */

export type CheckpointSummary = { checkpointId: string };

export type FetchRunCheckpointsResult =
  | { ok: true; checkpoints: CheckpointSummary[] }
  | { ok: false; status: number };

export const fetchRunCheckpoints = async (
  apiBase: string,
  runId: string
): Promise<FetchRunCheckpointsResult> => {
  const cpRes = await fetch(`${apiBase}/runs/${runId}/checkpoints`);
  if (!cpRes.ok) {
    return { ok: false, status: cpRes.status };
  }
  const checkpointsUnknown = await cpRes.json();
  const checkpoints = checkpointsUnknown as CheckpointSummary[];
  return { ok: true, checkpoints };
};
