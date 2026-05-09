# Adventure V2 Design

## 1. Objective

Design a new monorepo project (`adventure-v2`) that preserves the console adventure experience while adding explicit XState/LangGraph observability, reproducible checkpoint replay within the oracle lifecycle constraints in §2.1, and drift-aware reconcile behavior against an external authoritative engine.

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

### 2.1 External oracle lifecycle (considerations)

Distinguish three ideas:

- **In-game restart**: Control stays inside the Fortran program (for example re-init after game over). This is engine-internal flow, not v2 transport semantics.
- **Instruction-phase (or menu) process halt**: A path in the engine’s startup or instructions UX can **end the Fortran host process**—the same class of outcome as an operator interrupting the binary (for example Ctrl+C). The subprocess bridge may see early exit, partial or empty stdout, or non-zero exit codes that are **not** simply “bad JSON” or timeout. Today’s bridge often surfaces such exits like other oracle failures (`rejected`); longer term, a **terminal run outcome** (oracle ended / unavailable) may warrant a distinct contract from “retry another proposal” (see [`contracts-and-actors.md`](../../docs/architecture/adventure-v2/contracts-and-actors.md)).
- **Replay (R2) after oracle or binary restart**: The engine uses randomness. Spawning a **new** Fortran process re-initializes that state. Checkpoint replay restores recorded envelopes and cognition/control continuity, but **cannot promise** byte-identical or turn-identical reproduction of the original oracle transcript against a fresh process unless randomness is explicitly controlled (for example seed capture or single long-lived oracle). Treat oracle-forward replay after respawn as **best-effort**; deterministic replay is bounded by **oracle process lifetime**.

## 3. Key changes

### 3.1 API contracts

The **implemented** HTTP surface uses unversioned paths under `/runs` (see [`adventure-v2/README.md`](../../adventure-v2/README.md) for the canonical route table and payloads). At a glance:

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/health` | Liveness JSON (`status`, `service`); no run state |
| `POST` | `/runs` | Start a run (`CreateRunRequest` → `CreateRunResponse`) |
| `POST` | `/runs/{runId}/turns` | Submit turn input |
| `GET` | `/runs/{runId}/events` | SSE: turn, phase, trace events (`SseWireEvent`) |
| `GET` | `/runs/{runId}/checkpoints` | List checkpoint refs |
| `POST` | `/runs/{runId}/replay` | Replay from checkpoint |

**Request limits:** JSON bodies on `POST` routes are capped (default **256 KiB**; see [`adventure-v2/README.md`](../../adventure-v2/README.md) and `HTTP_MAX_JSON_BODY_BYTES` in the server). Oversize requests return **`413`** before schema validation.

**CORS:** Optional **`ADV_V2_CORS_ORIGINS`** env var (comma-separated allowed `Origin` strings). When unset or blank, responses use **`Access-Control-Allow-Origin: *`**. When set, only requests whose `Origin` matches an entry receive **`Access-Control-Allow-Origin`** (reflected); others omit it on JSON, SSE, and `OPTIONS` responses (see server `corsHeadersForRequest`).

**Not on the current wire:** dedicated session bootstrap, client-settings, or explicit stop routes as separate HTTP resources—the README “Not yet” and testing strategy describe optional follow-ons.

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

- **Web app**: keep immersive terminal visual; show phase machine state, graph node activity, and reconcile diffs. **Slice 15:** dedicated **game terminal** lane (echo `>`, `[agent]` proposal, oracle output) plus optional **raw SSE** panel — see [`adventure-v2/README.md`](../../adventure-v2/README.md) § v1-like terminal MVP. **Slice 16:** v1-style **CRT** presentation on the game terminal, **accumulated cognition trace** (all SSE `trace` rows, length-capped), **Mermaid** panels (LangGraph topology via `npm run codegen:brain-mermaid`, XState diagram hand-maintained + Vitest). Optional **`cognitionProfile`** on **`RunConfig`** labels experimental presets; the shell may persist **custom Mermaid** in **localStorage** for side-by-side plan exploration — server cognition graphs remain explicit extensions (same README § slice 16).
- **Server app**: orchestrate runs and emit ordered events; enforce deterministic sequencing boundaries.
- **Contracts package**: single source of truth for schemas and wire types (including extended **`CognitionTraceWire`** for LangGraph/prompt observability—see [`packages/contracts/src/http/wire.ts`](../../adventure-v2/packages/contracts/src/http/wire.ts)).
- **Cognition package**: LangGraph **`StateGraph`** pre-oracle (`perceive` → `plan` → `act`), stub prompts + digests on **`plan`** traces; optional full **`promptSystem`** / **`promptUser`** on **`CognitionTraceWire`** (capped per **`COGNITION_PROMPT_TEXT_MAX_CHARS`**); **`classifyReconcile`** unchanged; post-oracle **`reconcile`** trace emitted on SSE by the server (not implemented as a LangGraph node in slice 13).
- **Control package**: **`xstate`** (`createMachine` / `createActor`) for phases (`act`, `think`, `test`, `chaos`, `disorder`) and **`invalidRouting`** for invalid-action escalation.

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

This section distinguishes the **original design-only phase** from **ongoing work**. The repo now contains substantial in-tree runtime code (`adventure-v2` apps, contracts, HTTP/SSE, oracle bridges, Vitest gates)—see [`adventure-v2/README.md`](../../adventure-v2/README.md) and the [planning queue snapshot](../planning/plan-queues-index.md#current-development-loop-snapshot).

Remaining gaps and non-goals as of that README:

- Production deployment hardening; **LangGraph checkpointer** integration with **`CheckpointRef`** / replay (slice 13 wires the graph for observability; persistence remains the existing **`CheckpointRegistry`**).
- Real **ModelAdapter** / LLM calls inside **`plan`** (stub prompts + digests only in CI).
- Replacing the Fortran engine with a native TypeScript world engine for production-equivalent runs.
- ADK integration in v2 baseline.
- Production-grade energy profiling instrumentation (can be added later).
- Optional `@cucumber/cucumber` as CI runner (Vitest remains the gate; Gherkin files are reference specs).
