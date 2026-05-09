import {
  checkpointRefSchema,
  reconcileOutcomeSchema,
  sseWireEventSchema,
  type CognitionTraceWire,
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

export const formatCognitionTraceLine = (trace: CognitionTraceWire): string =>
  `[trace:${trace.nodeId}] seq=${trace.sequence} · ${trace.label} · payload=${JSON.stringify(trace.payload)} · ${trace.ts}`;

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
      const outcome =
        typeof env.payload.outcome === "string" ? env.payload.outcome : "?";
      return `${head} · outcome=${outcome} · rejected=${String(rejected)} · output=${JSON.stringify(
        typeof output === "string" ? output : JSON.stringify(output)
      )}`;
    }
    case "reconcile": {
      const r = reconcileOutcomeSchema.safeParse(env.payload);
      if (!r.success) {
        return `${head} · (reconcile payload did not match ReconcileOutcome schema)`;
      }
      const o = r.data;
      const summary =
        o.driftSummary !== undefined
          ? ` · ${o.driftSummary.trim().replace(/\s+/g, " ")}`
          : "";
      return `${head} · drift=${o.driftDetected} · class=${o.driftClass} · policy=${o.nextPolicy} · conf ${o.confidenceBefore.toFixed(2)}→${o.confidenceAfter.toFixed(2)}${summary}`;
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

export const formatWireEventForTranscript = (wire: SseWireEvent): string => {
  if (wire.event === "turn") {
    return formatTurnTranscriptLine(wire.envelope);
  }
  if (wire.event === "trace") {
    return formatCognitionTraceLine(wire.trace);
  }
  return formatPhaseTransitionLine(wire.transition);
};

/** Echo line after the player submits a turn (matches classic adventure `>` prompt). */
export const formatVirtualTerminalUserEcho = (input: string): string => {
  const t = input.trim();
  return t ? `> ${t}` : "";
};

/**
 * Human-readable chunk for the game terminal lane (proposal + oracle output only).
 * Other turn kinds are omitted so traces/phases stay in the raw SSE panel.
 */
export const formatVirtualTerminalTurnChunk = (env: TurnEnvelope): string | null => {
  if (env.kind === "proposal") {
    const action =
      typeof env.payload.action === "string" ? env.payload.action : String(env.payload.action ?? "?");
    return `[agent] ${action}`;
  }
  if (env.kind === "oracle_observation") {
    const output = env.payload.output;
    const text =
      typeof output === "string" ? output : JSON.stringify(output ?? "");
    return text.replace(/\s+$/, "");
  }
  return null;
};

export const formatVirtualTerminalWireChunk = (wire: SseWireEvent): string | null => {
  if (wire.event !== "turn") {
    return null;
  }
  return formatVirtualTerminalTurnChunk(wire.envelope);
};

export const formatCognitionTracePanel = (trace: CognitionTraceWire): string => {
  const lines = [
    "Latest cognition trace",
    `  nodeId:   ${trace.nodeId}`,
    `  label:    ${trace.label}`,
    `  turnId:   ${trace.turnId}`,
    `  sequence: ${trace.sequence}`
  ];
  if (trace.stepIndex !== undefined) {
    lines.push(`  stepIndex: ${trace.stepIndex}`);
  }
  if (trace.graphNodeId !== undefined) {
    lines.push(`  graphNodeId: ${trace.graphNodeId}`);
  }
  if (trace.promptDigest !== undefined) {
    lines.push(`  promptDigest: ${trace.promptDigest}`);
  }
  if (trace.promptSummary !== undefined) {
    lines.push(`  promptSummary: ${trace.promptSummary}`);
  }
  if (trace.promptRole !== undefined) {
    lines.push(`  promptRole: ${trace.promptRole}`);
  }
  if (trace.promptSystem !== undefined) {
    lines.push(`  promptSystem:`);
    for (const line of trace.promptSystem.split(/\r?\n/)) {
      lines.push(`    ${line}`);
    }
  }
  if (trace.promptUser !== undefined) {
    lines.push(`  promptUser:`);
    for (const line of trace.promptUser.split(/\r?\n/)) {
      lines.push(`    ${line}`);
    }
  }
  lines.push(`  payload:  ${JSON.stringify(trace.payload)}`);
  return lines.join("\n");
};

export const formatReconcilePanel = (env: TurnEnvelope): string | null => {
  if (env.kind !== "reconcile") {
    return null;
  }
  const r = reconcileOutcomeSchema.safeParse(env.payload);
  if (!r.success) {
    return "Latest reconcile: (invalid payload)\n" + JSON.stringify(env.payload, null, 2);
  }
  const o = r.data;
  const lines = [
    "Latest reconcile (ReconcileOutcome)",
    `  driftDetected: ${o.driftDetected}`,
    `  driftClass:    ${o.driftClass}`,
    `  nextPolicy:    ${o.nextPolicy}`,
    `  confidence:    ${o.confidenceBefore} → ${o.confidenceAfter}`,
    `  beliefPatch:   ${JSON.stringify(o.beliefPatch)}`
  ];
  if (o.correlationId !== undefined) {
    lines.push(`  correlationId: ${o.correlationId}`);
  }
  if (o.driftSummary !== undefined) {
    lines.push(`  driftSummary:  ${o.driftSummary.trim().replace(/\s+/g, " ")}`);
  }
  if (o.evidence !== undefined) {
    lines.push(`  evidence:      ${JSON.stringify(o.evidence)}`);
  }
  return lines.join("\n");
};
