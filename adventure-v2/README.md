# adventure-v2

Planned v2 runtime for benchmark-oriented adventure orchestration.

## Scope in this phase

- **Contracts** (`packages/contracts`): turn/reconcile/checkpoint schemas plus **HTTP/SSE wire types** (`CreateRunRequest`, `SseWireEvent`, …).
- **Server** (`apps/server`): `RunCoordinator` with **LangGraph.js** pre-oracle cognition (`perceive` → `plan` → `act`), **`xstate`** loop policy, a **swappable oracle bridge** (synthetic default, optional **process** adapter per [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md)), **SSE fanout** of turn, phase, and cognition trace events, and a small **HTTP API** (`POST /runs`, `POST /runs/:id/turns`, `GET /runs/:id/events`).
- **Web shell** (`apps/web`): Vite page that starts a run, opens SSE (`EventSource`), and provides an **interactive command** input (multi-turn **`POST /turns`**), optional **replay demo** (first checkpoint), and **stub autoplay** (deterministic command cycle, no LLM). Panels: **game terminal** (human-readable echo + agent + oracle text), optional raw SSE log, phase, reconcile, checkpoints, cognition trace.
- **Tests**: Vitest contract, in-process acceptance (`tests/acceptance.test.ts`), and **HTTP acceptance** (`tests/http.acceptance.test.ts`) against a real listener on an ephemeral port.

**Optional (local benchmarks):** set `ADV_V2_PROCESS_ORACLE_SCRIPT` when running `npm run dev:server` to a `.js`/`.mjs` oracle implementing the subprocess JSON line protocol in [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md) (typically `fixtures/oracle-stub.mjs`). **Vitest stays on the synthetic oracle** unless a test constructs `createProcessOracleBridge` explicitly.

**Fortran oracle (CI + opt-in local):** GitHub Actions compiles the repo-root `./adventure` and runs `npm run test:oracle-fortran`, which drives [`fixtures/oracle-fortran-bridge.mjs`](fixtures/oracle-fortran-bridge.mjs) against that binary. Locally: `make adventure` from the repo root, then the same npm script from `adventure-v2/`. **Default `npm test` does not** run `tests/oracleFortran.ci.test.ts` (see [`vitest.config.ts`](vitest.config.ts) exclude list).

**Not yet:** further deployment hardening (auth, rate limits, TLS termination).

### v1-like terminal MVP (slice 15)

The web shell includes a **game terminal** lane (human-readable): echoed commands (`>`), `[agent]` proposals, and plain oracle/Fortran output. The raw **SSE transcript** remains available for debugging (toggle **Show raw SSE log**).

**Fortran binary vs synthetic oracle:**

| Goal | Command |
|------|---------|
| Default dev (synthetic oracle, no Fortran) | `npm run dev:server` |
| Real `./adventure` subprocess via bridge | From repo root: `make adventure`, then from `adventure-v2/`: `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs npm run dev:server` |

CI exercises the Fortran bridge via `npm run test:oracle-fortran` after `make adventure`.

**Remaining gaps vs a full “prod” MVP:** real **ModelAdapter** / SLM calls in **`plan`** (still stub prompts + digests), optional **XState snapshot** on the wire (today: phase transitions only), **LangGraph checkpointer** unification with **`CheckpointRegistry`**, and optional browser E2E (Playwright).

**Slice 12 (configurable CORS):** set comma-separated **`ADV_V2_CORS_ORIGINS`** on the server process to restrict browser `Origin` values that receive `Access-Control-Allow-Origin` (reflected origin per request). When unset or blank, behavior matches earlier slices: **`Access-Control-Allow-Origin: *`** on JSON, SSE, and `OPTIONS` responses. Covered in `tests/http.acceptance.test.ts`.

**Slice 13 (LangGraph + XState + trace observability):** Each turn runs through `@langchain/langgraph` (`packages/cognition/src/brain/runTurnBrainGraph.ts`) emitting **four** trace rows before/around reconcile (`perceive`, `plan`, `act`, plus post-oracle `reconcile`). Stub prompts live in `packages/cognition/src/prompts/`; **`plan`** traces include **`promptDigest`** / **`promptSummary`** for observability. **`packages/control`** uses **`xstate`** (`createMachine` + `createActor`) with an internal **`invalidRouting`** transient state for invalid-action escalation. **`POST /runs/:id/turns`** awaits async cognition (`processTurn`). One full turn yields **10** SSE wire events (4× `turn`, 4× `trace`, 2× `phase`); HTTP acceptance and Cucumber steps expect **10** events per turn. **`CognitionTraceWire`** adds optional **`graphNodeId`**, **`stepIndex`**, **`promptDigest`**, **`promptSummary`**, **`promptRole`**. Close-out: [`slice-13-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-13-multidisciplinary-review.md).

**Slice 14 (interactive shell + full plan prompts + stub autoplay):** Web UI command field and multi-turn play; **`plan`** traces may include full **`promptSystem`** / **`promptUser`** (capped by **`COGNITION_PROMPT_TEXT_MAX_CHARS`** in `packages/contracts/src/http/wire.ts`, enforced in `packages/cognition/src/brain/promptDigest.ts`). Stub autoplay in the browser loops **`POST /turns`** via `apps/web/src/stubAutoplayPlanner.ts` (no new HTTP routes). HTTP acceptance includes **two sequential turns** on one run. Close-out: [`slice-14-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-14-multidisciplinary-review.md).

**Slice 15 (virtual terminal lane):** Pure formatters in `apps/web/src/wireDisplay.ts` build a readable terminal transcript (`>` echo, `[agent]` line, oracle output); **`index.html`** / **`main.ts`** add **`#game-terminal`** and a **Show raw SSE log** checkbox. Close-out: [`slice-15-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-15-multidisciplinary-review.md).

**Slice 8 (R3 reconcile visibility):** `ReconcileOutcome` adds optional `correlationId`, `driftSummary`, and `evidence` (oracle outcome + capped output excerpt). Oracle turn payloads include optional `outcome` (`accepted` \| `rejected` \| `transport_error`); subprocess harness failures map to `transport_error` so reconcile uses `driftClass: "unknown"` vs validation-style `parser` rejection.

**Slice 9 (HTTP Gherkin):** `npm run test:cucumber` runs `@cucumber/cucumber` against `tests/features/http/*.feature` using the same HTTP+SSE helpers as `tests/http.acceptance.test.ts` (`tests/helpers/httpWire.ts`). Vitest remains the primary CI gate; Cucumber is an optional readability layer for wire scenarios.

**Slice 10 (R5 on HTTP wire):** `tests/http.acceptance.test.ts` asserts invalid-action escalation (`test` and `chaos` phases on SSE) after repeated `forceReject` turns; `tests/features/http/r5_invalid_action_recovery.feature` mirrors that path in Gherkin.

**Slice 11 (operational readiness):** `GET /health` returns `200` with `{ "status": "ok", "service": "adventure-v2" }` for liveness checks. JSON bodies on `POST` routes are capped at **256 KiB** (`HTTP_MAX_JSON_BODY_BYTES` in `apps/server/src/http/createServer.ts`); oversize requests get **`413`** with `{ "error": "payload_too_large", … }`. Covered in `tests/http.acceptance.test.ts`.

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

## HTTP API (slices 2–3, extended slices 11–12)

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/health` | `200` `{ "status": "ok", "service": "adventure-v2" }` — liveness (no run state) |
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE** stream: `event: turn` / `event: phase` / `event: trace` with JSON payloads matching `SseWireEvent` |
| `GET` | `/runs/:runId/checkpoints` | `200` JSON array of `CheckpointRef` (empty until at least one turn completes) |
| `POST` | `/runs/:runId/replay` | Body `{ "checkpointId": string }` → `200` `{ ReplayRestorePayload }`; `404` `{ "error":"not_found" }` if the id is unknown or not for this run |

`POST` bodies that exceed **256 KiB** total bytes return **`413`** `{ "error": "payload_too_large", "message": … }` before JSON parsing.

`OPTIONS` is supported for CORS preflight. Default **`Access-Control-Allow-Origin: *`**. With **`ADV_V2_CORS_ORIGINS`** set (comma-separated exact origins), only matching request `Origin` values get a reflected `Access-Control-Allow-Origin`; disallowed origins omit that header on JSON, SSE, and `OPTIONS` responses.

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

Restrict browser origins when the API and web app use different origins (comma-separated; spaces around commas are trimmed):

```bash
ADV_V2_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 npm run dev:server
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
| Control / cognition | `tests/controlMachine.test.ts`, `contracts.test.ts` (golden trace order), `tests/promptCap.test.ts` | XState escalation path; LangGraph node order + reconcile trace; prompt wire caps. |
| Web shell helpers | `tests/shellState.test.ts`, `tests/stubAutoplayPlanner.test.ts` | Pure transcript + stub autoplay planner. |
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

**Process:** follow Red–Green–Refactor and separate structural from behavioral commits when touching tests (see repo `.cursor/rules/process-03-development.mdc`). Before merging changes, run **full regression:** `npm test` then `npm run test:cucumber` (same order as CI); add `npm run test:oracle-fortran` after edits to oracle/subprocess code.

## Verification

```bash
npm install   # once
npm test      # contract + acceptance + HTTP + oracle stub + wireDisplay
npm run test:cucumber   # HTTP Gherkin (includes R5 recovery scenario); matches CI after Vitest

# After `make adventure` at repo root (optional locally; CI runs this):
npm run test:oracle-fortran
```
