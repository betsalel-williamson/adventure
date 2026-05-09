# Adventure V2 Contracts and Actor Ownership

## Purpose

Define shared runtime contracts and explicit ownership boundaries between LangGraph cognition actors and XState control actors.

The runtime flows that exercise these contracts (nominal turn, drift, recovery,
replay, session lifecycle) are documented as actor sequence diagrams in
[`process-view.md`](./process-view.md#scenario-flows).

## Contract set

### Turn contract (`TurnEnvelope`)

- `runId`: string
- `turnId`: string
- `sequence`: number (monotonic)
- `source`: `"client" | "cognition" | "oracle" | "control"`
- `kind`: finite enum (perceive, proposal, oracle_observation, reconcile, checkpoint, recovery)
- `ts`: ISO timestamp
- `payload`: discriminated union by `kind`

### Reconcile contract (`ReconcileOutcome`)

- `runId`, `turnId`, `sequence`
- `driftDetected`: boolean
- `driftClass`: `"none" | "location" | "inventory" | "constraint" | "parser" | "unknown"`
- `beliefPatch`: object (partial inferred state update)
- `confidenceBefore`: number (0..1)
- `confidenceAfter`: number (0..1)
- `nextPolicy`: `"continue" | "test" | "chaos"`

An optional **subprocess oracle** implementing the bridge observation contract is specified in [oracle-subprocess-ipc.md](./oracle-subprocess-ipc.md).

### Checkpoint contract (`CheckpointRef`)

- `checkpointId`: string
- `runId`: string
- `threadId`: string
- `turnId`: string
- `sequence`: number
- `replayInputRef`: string
- `createdAt`: ISO timestamp

`CheckpointRef` is an immutable pointer contract only. It is not a full restore
artifact and does not inline cognition/control state payloads.

### Replay restore payload contract (`ReplayRestorePayload`)

- `checkpointId`: string
- `runId`: string
- `sequence`: number
- `replayInputRef`: string (cognition state snapshot reference)
- `controlPhase`: `"act" | "think" | "test" | "chaos" | "disorder"`
- `pendingOracleSequence`: number | null (set when replay resumes from `disorder`)
- `restoredAt`: ISO timestamp

The Checkpoint Registry resolves a `CheckpointRef` into `ReplayRestorePayload`
for replay operations.

### Internal control signals (non-wire contracts)

These signals are internal actor coordination events. They are not part of
shared `TurnEnvelope` wire payloads exposed to clients.

| Signal | Produced by | Consumed by |
|--------|-------------|-------------|
| `PhaseRequest` | Cognition Graph | Control Machine |
| `PhaseGrant` | Control Machine | Cognition Graph |
| `OracleObservationDispatched` | Run Coordinator | Control Machine |
| `PolicyHint` | Control Machine | Cognition Graph |
| `RestoreState` | Run Coordinator | Cognition Graph |
| `RestorePhase` | Run Coordinator | Control Machine |

## Actor ownership

### LangGraph ownership (`packages/cognition`)

- Maintains cognition graph state and node transitions.
- Produces `ActionProposal`.
- Consumes `OracleObservation`.
- Produces `ReconcileOutcome`.
- Emits checkpoint save requests with sufficient replay metadata.

### XState ownership (`packages/control`)

- Owns operational loop phase transitions. Phases are named for runtime policy,
  but each maps to a [Cynefin framework](https://en.wikipedia.org/wiki/Cynefin_framework)
  **problem context**: what kind of cause-and-effect relationship the run is in,
  and therefore which response pattern is appropriate.

#### Cynefin contexts (system states)

Cynefin distinguishes five **system states**. The control machine maps all five
to explicit phases: the four ordered domains plus **`disorder`**, the interval
where the run has oracle feedback for the current sequence but has not yet
consumed a `ReconcileOutcome` (or the situation is otherwise unclassified).

| Cynefin domain | Typical response pattern | Control phase | Meaning in this runtime |
|----------------|-------------------------|---------------|-------------------------|
| **Obvious** (clear / simple) | Sense → categorize → respond | `act` | Cause and effect are clear; execute a stable, rule-following loop (nominal propose → oracle → reconcile). |
| **Complicated** | Sense → analyze → respond | `think` | Cause and effect are knowable but not immediate; deliberate, compare options, or narrow hypotheses before the next oracle interaction. |
| **Complex** | Probe → sense → respond | `test` | Cause and effect emerge only through interaction; safe-to-fail tries, parser or drift experiments, and reconcile-driven learning (`ReconcileOutcome.nextPolicy = "test"`). |
| **Chaotic** | Act → sense → respond | `chaos` | No stable pattern yet; stabilize the loop first (tighten action surface, recovery moves) then re-sense (`nextPolicy = "chaos"`). |
| **Disorder** (confused / unclassified) | *Classify before adopting a domain pattern* | `disorder` | From dispatch of `OracleObservation` for the active sequence until the Control Machine consumes `ReconcileOutcome`: context is not yet mapped to an ordered-domain phase. `nextPolicy` and escalation rules then select `act`, `think`, `test`, or `chaos`. |

#### Phase transitions (summary)

- **`disorder`**: Entered when oracle feedback for the active sequence is dispatched to cognition and reconcile is still pending; also used when classification is incomplete until the next `ReconcileOutcome`. Not driven by `nextPolicy`—it precedes consumption of `ReconcileOutcome`.
- **`act`**: Obvious-context execution; aligns with `nextPolicy = "continue"` after a clean reconcile.
- **`think`**: Complicated-context deliberation; used when analysis must precede the next committed action (without yet escalating to probe-first or stabilize-first modes).
- **`test`**: Complex-context probing; aligns with `nextPolicy = "test"`.
- **`chaos`**: Chaotic-context stabilization; aligns with `nextPolicy = "chaos"`.

#### Responsibilities

- Consumes reconcile outputs and policy hints.
- Emits phase-transition telemetry for UI and run analytics.

### Server ownership (`apps/server`)

- Guarantees event ordering and sequence assignment.
- Coordinates oracle I/O and stream fanout.
- After delivering `OracleObservation` to the Cognition Graph for a sequence,
  notifies the Control Machine so the phase may enter `disorder` until
  `ReconcileOutcome` is consumed for that sequence.
- Persists run artifacts and checkpoint registry.

## Ownership guardrails

- XState does not declare world truth; it governs policy and process.
- LangGraph does not bypass server sequencing.
- Reconcile is mandatory before phase returns to nominal `act` after an oracle turn.
- Any replay must restore both checkpoint state and control phase state (including `disorder` when it was the persisted phase at the checkpoint boundary).

## Producer/consumer matrix

Each contract has a single owning producer; consumers must not synthesize the
contract themselves. See `process-view.md` for the timing of these flows.

| Contract | Produced by | Consumed by |
|----------|-------------|-------------|
| `TurnEnvelope` (sequence assignment) | Run Coordinator (`apps/server`) | Cognition Graph, Control Machine, Web Client |
| `ActionProposal` | Cognition Graph (`packages/cognition`) | Oracle Bridge (via Run Coordinator) |
| `OracleObservation` | Oracle Bridge (`apps/server`) | Cognition Graph |
| `ReconcileOutcome` | Cognition Graph | Control Machine, Run Coordinator (for fanout) |
| Phase transition event | Control Machine (`packages/control`) | Run Coordinator, Web Client |
| `CheckpointRef` | Cognition Graph (request) → Checkpoint Registry (commit) | Run Coordinator (replay), Web Client (timeline) |
| `ReplayRestorePayload` | Checkpoint Registry (`apps/server`) | Run Coordinator, Cognition Graph, Control Machine |
