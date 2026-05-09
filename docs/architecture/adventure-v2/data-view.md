# Adventure V2 Data View

## Core entities

- `RunConfig`: run-scoped launch config (provider/model selection, benchmark profile, seed parameters).
- `ClientSessionSettings`: session-scoped UI/planner settings synchronized by server API (for example autoplay mode, pace, max moves, prompt experiment patch, active prompt project).
- `TurnEnvelope`: ordered turn event record with source and timestamps.
- `ActionProposal`: model proposed action with parser diagnostics.
- `OracleObservation`: transcript delta and validation outcome.
- `ReconcileOutcome`: inferred state updates and drift metadata.
- `CheckpointRef`: immutable pointer to replayable state boundary.
- `RunSummary`: aggregated metrics for comparison.

`RunConfig` model descriptors must support the benchmark categories used by v2 docs:
`SLM`, `LLM`, `API`, and `MLX`.

## Canonical contracts

Contracts live in `adventure-v2/packages/contracts` and are consumed by web, server, cognition, and control packages.

Minimum schema groups:

- `packages/contracts/src/events/*` for turn and stream events.
- `packages/contracts/src/reconcile/*` for drift and belief update models.
- `packages/contracts/src/checkpoints/*` for replay and restore.
- `packages/contracts/src/api/*` for run/session API payloads.

## Data lineage

1. Client session bootstrap issues session principal and returns `ClientSessionSettings`.
2. Optional client settings update patches `ClientSessionSettings` for that session.
3. Client run request creates `RunConfig`.
4. Cognition emits `ActionProposal`.
5. Oracle returns `OracleObservation`.
6. Reconcile creates `ReconcileOutcome`.
7. Turn boundary persists `CheckpointRef`.
8. Run completion generates `RunSummary`.

## Data quality constraints

- Every turn has a monotonic sequence number.
- Replay references immutable checkpoint IDs.
- Reconcile output must include prior and next confidence for auditability.
- Drift classes must be finite and enumerable for benchmark statistics.
- Session settings are scoped to one session principal and must not mutate other sessions.
- Client-stored preferences are hints only; server-side settings payload remains the authority used by runtime APIs.

### Replay vs oracle respawn

These constraints apply when the run uses the **external Fortran `adventure` oracle** (subprocess bridge). The default **synthetic** in-process oracle used for zero-config CI is not subject to the same RNG respawn issue unless configured otherwise.

`CheckpointRef` and replay artifacts remain authoritative for **restoring server-side cognition/control state** and **recorded** envelopes. They do **not**, by themselves, guarantee faithful **re-execution** of the Colossal Cave engine’s random behavior:

- The Fortran oracle uses **runtime randomness**. Restarting the **binary** (new process) re-seeds that behavior.
- **Oracle-forward replay** after spawning a fresh oracle is therefore **best-effort**: transcripts may diverge from an earlier run for the same logical command sequence without implying reconcile bugs.
- **Strict reproducibility** of oracle output generally assumes replay **within one long-lived oracle instance**, or future mechanisms such as **captured seeds** or an oracle harness that preserves RNG state across turns—out of scope unless explicitly added to contracts and bridges.

See **Replay vs a fresh oracle** in [`process-view.md`](./process-view.md).
