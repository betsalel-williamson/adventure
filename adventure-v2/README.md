# adventure-v2

Planned v2 runtime for benchmark-oriented adventure orchestration.

## Scope in this phase

- **Contracts** (`packages/contracts`): turn/reconcile/checkpoint schemas plus **HTTP/SSE wire types** (`CreateRunRequest`, `SseWireEvent`, …).
- **Server** (`apps/server`): `RunCoordinator` with a **swappable oracle bridge** (synthetic default, optional **process** adapter per [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md)), **SSE fanout** of turn, phase, and cognition trace events, and a small **HTTP API** (`POST /runs`, `POST /runs/:id/turns`, `GET /runs/:id/events`).
- **Web shell** (`apps/web`): minimal Vite page that starts a run, issues a sample turn, and reads the SSE stream (`EventSource`) into transcript, phase, reconcile, checkpoint, and cognition trace panels.
- **Tests**: Vitest contract, in-process acceptance (`tests/acceptance.test.ts`), and **HTTP acceptance** (`tests/http.acceptance.test.ts`) against a real listener on an ephemeral port.

**Optional (local benchmarks):** set `ADV_V2_PROCESS_ORACLE_SCRIPT` when running `npm run dev:server` to a `.js`/`.mjs` oracle implementing the subprocess JSON line protocol in [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md) (typically `fixtures/oracle-stub.mjs`). **Vitest stays on the synthetic oracle** unless a test constructs `createProcessOracleBridge` explicitly.

**Fortran oracle (CI + opt-in local):** GitHub Actions compiles the repo-root `./adventure` and runs `npm run test:oracle-fortran`, which drives [`fixtures/oracle-fortran-bridge.mjs`](fixtures/oracle-fortran-bridge.mjs) against that binary. Locally: `make adventure` from the repo root, then the same npm script from `adventure-v2/`. **Default `npm test` does not** run `tests/oracleFortran.ci.test.ts` (see [`vitest.config.ts`](vitest.config.ts) exclude list).

**Not yet:** production deployment hardening.

**Slice 8 (R3 reconcile visibility):** `ReconcileOutcome` adds optional `correlationId`, `driftSummary`, and `evidence` (oracle outcome + capped output excerpt). Oracle turn payloads include optional `outcome` (`accepted` \| `rejected` \| `transport_error`); subprocess harness failures map to `transport_error` so reconcile uses `driftClass: "unknown"` vs validation-style `parser` rejection.

**Slice 9 (HTTP Gherkin):** `npm run test:cucumber` runs `@cucumber/cucumber` against `tests/features/http/*.feature` using the same HTTP+SSE helpers as `tests/http.acceptance.test.ts` (`tests/helpers/httpWire.ts`). Vitest remains the primary CI gate; Cucumber is an optional readability layer for wire scenarios.

## Planned structure

```text
adventure-v2/
  apps/
    web/
    server/
  packages/
    contracts/
    cognition/
    control/
  docs/
```

## Package responsibilities

- `apps/web`: terminal-style UI and actor/state observability panes.
- `apps/server`: run/session APIs, oracle bridge, event streaming.
- `packages/contracts`: shared schemas for events, reconcile, checkpoints, APIs.
- `packages/cognition`: LangGraph orchestration and reconcile pipeline.
- `packages/control`: XState loop-control machine and telemetry policy.
- `docs`: package-local docs that reference root architecture/ADR docs.

## Model surface (planned)

- `SLM`: smaller local language models for low-latency benchmark runs.
- `LLM`: larger hosted language models for quality-oriented benchmark runs.
- `API`: provider-backed model access through typed server-side integrations.
- `MLX`: local Apple Silicon execution path for on-device model experiments.

## HTTP API (slices 2–3)

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE** stream: `event: turn` / `event: phase` / `event: trace` with JSON payloads matching `SseWireEvent` |
| `GET` | `/runs/:runId/checkpoints` | `200` JSON array of `CheckpointRef` (empty until at least one turn completes) |
| `POST` | `/runs/:runId/replay` | Body `{ "checkpointId": string }` → `200` `{ ReplayRestorePayload }`; `404` `{ "error":"not_found" }` if the id is unknown or not for this run |

`OPTIONS` is supported for CORS preflight (`Access-Control-Allow-Origin: *` on responses).

## Local dev

Terminal A — API (default port `8787`; bind `0.0.0.0`):

```bash
npm run dev:server
```

Terminal B — web shell (Vite, port `5173`):

```bash
npm run dev:web
```

Point the UI at a different API origin if needed:

```bash
VITE_API_URL=http://127.0.0.1:9999 npm run dev:web
```

Optional process oracle for the HTTP server (`cwd` should be `adventure-v2` so relative paths resolve):

```bash
ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-stub.mjs npm run dev:server
```

## Bootstrap plan (historical)

1. Define workspace/package manifests.
2. Add Cucumber-style behavior features (Gherkin) plus schema-first contract tests.
3. Add minimal server run lifecycle with synthetic fixtures.
4. Add web shell with transcript + state panel placeholders.
5. Wire cognition/control packages behind stable contracts.

## Testing strategy

**CI gate:** from this directory, `npm test` runs Vitest once (`vitest run`) over `tests/**/*.test.ts` but **`vitest.config.ts` excludes** `tests/oracleFortran.ci.test.ts`. GitHub Actions runs `npm audit` after `npm ci`, then `npm run test:cucumber` for HTTP Gherkin scenarios. `npm run test:oracle-fortran` uses [`vitest.oracle-ci.config.ts`](vitest.oracle-ci.config.ts) so only that file runs, with `ADV_V2_CI_FORTRAN=1`. The root workflow [`.github/workflows/adventure-v2.yml`](../.github/workflows/adventure-v2.yml) installs `gfortran`, runs `make adventure` at the repo root, then `npm run test:oracle-fortran`.

**Layers (test pyramid):**

| Layer | Files | Role |
|--------|--------|------|
| Contracts | `tests/contracts.test.ts` | Schema and wire-shape regressions against `packages/contracts`. |
| In-process acceptance | `tests/acceptance.test.ts`, `tests/steps/runSteps.ts` | R1–R5 behaviors via `RunCoordinator` without HTTP. |
| HTTP + SSE | `tests/http.acceptance.test.ts`, `tests/helpers/httpWire.ts` | Same contracts over a real listener on an ephemeral port; matches what the web shell uses. |
| HTTP Gherkin (optional) | `tests/features/http/*.feature`, `tests/cucumber/*.ts` | Cucumber reuses `httpWire` + `listenAdventureServer`; run via `npm run test:cucumber`. |
| Oracle subprocess | `tests/oracleProcess.test.ts` | `createProcessOracleBridge` + `fixtures/oracle-stub.mjs`. |
| Fortran oracle (CI / opt-in) | `tests/oracleFortran.ci.test.ts` | Same bridge seam against `fixtures/oracle-fortran-bridge.mjs` + built `./adventure`; run via `npm run test:oracle-fortran` (`vitest.oracle-ci.config.ts`) only. |
| Web helpers | `tests/wireDisplay.test.ts` | Pure parse/format helpers for transcript, reconcile, and cognition trace panels from `apps/web` (Node environment; no DOM). |

**Gherkin feature files:** `tests/features/r*.feature` remain the **human-readable** R1–R5 reference; those scenarios are implemented in Vitest (`acceptance.test.ts`). **`tests/features/http/`** is executed by Cucumber (`npm run test:cucumber`) against the real HTTP API so Gherkin stays aligned with the wire contract without replacing Vitest.

**Design doc alignment:** parallel step definitions are limited to **HTTP** scenarios and share `httpWire` parsing with `http.acceptance.test.ts`, avoiding a second interpretation of SSE payloads.

**Browser / DOM:** interactive wiring in `apps/web/src/main.ts` is covered indirectly by HTTP acceptance (wire format) and by unit tests on `wireDisplay.ts`. There is no Playwright or happy-dom suite yet; add one only when DOM integration bugs outweigh maintenance cost.

**Coverage:** optional signal-only — no enforced percentage thresholds (see repo evidence-based engineering principles):

```bash
npm run test:coverage   # HTML report under coverage/ (gitignored)
```

**Process:** follow Red–Green–Refactor and separate structural from behavioral commits when touching tests (see repo `.cursor/rules/process-03-development.mdc`).

## Verification

```bash
npm install   # once
npm test      # contract + acceptance + HTTP + oracle stub + wireDisplay
npm run test:cucumber   # optional; HTTP Gherkin vs same listener as http.acceptance.test.ts

# After `make adventure` at repo root (optional locally; CI runs this):
npm run test:oracle-fortran
```
