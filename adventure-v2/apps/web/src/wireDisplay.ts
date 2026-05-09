import {
  checkpointRefSchema,
  reconcileOutcomeSchema,
  sseWireEventSchema,
  type PhaseTransitionWire,
  type SseWireEvent,
  type TurnEnvelope
} from "@contracts";

export const parseSseWirePayload = (raw: string): SseWireEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const r = sseWireEventSchema.safeParse(parsed);
  return r.success ? r.data : null;
};

export const formatPhaseTransitionLine = (t: PhaseTransitionWire): string =>
  `[phase] ${t.from} → ${t.to} · ${t.reason} · seq=${t.sequence} · ${t.ts}`;

export const formatTurnTranscriptLine = (env: TurnEnvelope): string => {
  const head = `[turn:${env.kind}] seq=${env.sequence} · ${env.source}`;
  switch (env.kind) {
    case "proposal": {
      const action =
        typeof env.payload.action === "string" ? env.payload.action : String(env.payload.action ?? "?");
      return `${head} · action=${JSON.stringify(action)}`;
    }
    case "oracle_observation": {
      const rejected = env.payload.rejected;
      const output = env.payload.output;
      return `${head} · rejected=${String(rejected)} · output=${JSON.stringify(
        typeof output === "string" ? output : JSON.stringify(output)
      )}`;
    }
    case "reconcile": {
      const r = reconcileOutcomeSchema.safeParse(env.payload);
      if (!r.success) {
        return `${head} · (reconcile payload did not match ReconcileOutcome schema)`;
      }
      const o = r.data;
      return `${head} · drift=${o.driftDetected} · class=${o.driftClass} · policy=${o.nextPolicy} · conf ${o.confidenceBefore.toFixed(2)}→${o.confidenceAfter.toFixed(2)}`;
    }
    case "checkpoint": {
      const c = checkpointRefSchema.safeParse(env.payload);
      if (!c.success) {
        return `${head} · (checkpoint payload did not match CheckpointRef schema)`;
      }
      const p = c.data;
      return `${head} · checkpointId=${p.checkpointId} · turn=${p.turnId} · replayInputRef=${p.replayInputRef}`;
    }
    default:
      return `${head} · ${JSON.stringify(env.payload)}`;
  }
};

export const formatWireEventForTranscript = (wire: SseWireEvent): string =>
  wire.event === "turn"
    ? formatTurnTranscriptLine(wire.envelope)
    : formatPhaseTransitionLine(wire.transition);

export const formatReconcilePanel = (env: TurnEnvelope): string | null => {
  if (env.kind !== "reconcile") {
    return null;
  }
  const r = reconcileOutcomeSchema.safeParse(env.payload);
  if (!r.success) {
    return "Latest reconcile: (invalid payload)\n" + JSON.stringify(env.payload, null, 2);
  }
  const o = r.data;
  return [
    "Latest reconcile (ReconcileOutcome)",
    `  driftDetected: ${o.driftDetected}`,
    `  driftClass:    ${o.driftClass}`,
    `  nextPolicy:    ${o.nextPolicy}`,
    `  confidence:    ${o.confidenceBefore} → ${o.confidenceAfter}`,
    `  beliefPatch:   ${JSON.stringify(o.beliefPatch)}`
  ].join("\n");
};
