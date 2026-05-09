# Adventure V2 Design

## 1. Objective

Design a new monorepo project (`adventure-v2`) that preserves the console adventure experience while adding explicit XState/LangGraph observability, deterministic replay, and drift-aware reconcile behavior against an external authoritative engine.

## 2. Technical design

Adventure v2 separates responsibilities into five packages:

- `apps/web`: Console-first UI, run controls, and state/actor inspection panes.
- `apps/server`: Session lifecycle, SSE/event streaming, oracle bridge, and benchmark orchestration endpoints.
- `packages/contracts`: Shared turn event envelopes, reconcile outcomes, checkpoint metadata, and API schemas.
- `packages/cognition`: LangGraph orchestration (`Perceive -> Route -> Plan -> Act -> Reconcile`).
- `packages/control`: XState control machine for runtime phase management (`act`, `think`, `test`, `chaos`, `disorder`) and telemetry normalization.

Model/provider scope for benchmark runs is expressed with four categories used across v2 docs:
`SLM`, `LLM`, `API`, and `MLX`.

The authoritative game truth remains external (Fortran `adventure` program). Internal cognition/control state is explicitly modeled as potentially stale and is corrected via reconcile after oracle output.

This design aligns with and supersedes relevant parts of:

- `docs/architecture/overview.md`
- `docs/architecture/adventure-engine.md`
- `docs/architecture/adventure-nl-cognition-and-workspace.md`

## 3. Key changes

### 3.1 API contracts

Planned v2 API contract families:

- Session and run control:
  - `POST /api/v2/sessions`
  - `POST /api/v2/runs`
  - `POST /api/v2/runs/{runId}/stop`
- Turn/event streaming:
  - `GET /api/v2/runs/{runId}/events` (SSE)
- Replay/checkpoint:
  - `GET /api/v2/runs/{runId}/checkpoints`
  - `POST /api/v2/runs/{runId}/replay`

Final payloads are defined in `adventure-v2/packages/contracts`.

### 3.2 Data models

Core shared models:

- `TurnEnvelope`: normalized event for each turn with timestamps and source.
- `ActionProposal`: model-proposed action plus parser/coercion diagnostics.
- `OracleObservation`: transcript delta and oracle-side validation result.
- `ReconcileOutcome`: belief diffs, confidence adjustment, and drift markers.
- `CheckpointRef`: run/thread/turn linkage for replay and audit.
- `RunSummary`: aggregate metrics (steps, rejects, drift, latency percentiles).

`RunConfig` metadata must preserve which category (`SLM`/`LLM`/`API`/`MLX`) and concrete provider/model pair was used per run.

### 3.3 Component responsibilities

- **Web app**: keep immersive terminal visual; show phase machine state, graph node activity, and reconcile diffs.
- **Server app**: orchestrate runs and emit ordered events; enforce deterministic sequencing boundaries.
- **Contracts package**: single source of truth for schemas and wire types.
- **Cognition package**: host LangGraph node logic and checkpoint integration.
- **Control package**: host XState machine and loop transition criteria.

### 3.4 Testing framework strategy (Cucumber-style TDD)

Adventure v2 will use a Cucumber-style TDD approach:

- Behavior is specified first in Gherkin (`Feature`, `Scenario`, `Scenario Outline`) from user outcomes.
- Acceptance scenarios are mapped to contract and integration tests before implementation.
- Work follows Red-Green-Refactor with BDD acceptance tests as the outer loop.

Best-practice mapping:

- Keep feature files business-readable and stable; hide transport details in step definitions.
- Maintain deterministic fixtures for replay/checkpoint scenarios.
- Prefer typed, reusable step utilities over ad hoc regex-heavy steps.
- Separate acceptance behavior tests from low-level unit tests while keeping both traceable to R1-R5.

## 4. Alternatives considered

- Extend `adventure-nl` in place:
  - Rejected for v2 because coupling existing behavior with new runtime contracts increases migration risk and weakens benchmark clarity.
- Use XState as authoritative world physics in all modes:
  - Rejected because Fortran remains authoritative for production-comparable runs; XState is used for control policy and observability.
- Use only LangGraph without explicit control machine:
  - Rejected because operational legibility and loop governance are improved by a dedicated XState control layer.

## 5. Out of scope

- Full implementation of v2 runtime and UI in this phase.
- Replacing the Fortran engine with a native TypeScript world engine for production-equivalent runs.
- ADK integration in v2 baseline.
- Production-grade energy profiling instrumentation (can be added later).
