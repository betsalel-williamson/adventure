# adventure-v2

Planned v2 runtime for benchmark-oriented adventure orchestration.

## Scope in this phase

- **Contracts** (`packages/contracts`): turn/reconcile/checkpoint schemas plus **HTTP/SSE wire types** (`CreateRunRequest`, `SseWireEvent`, …).
- **Server** (`apps/server`): `RunCoordinator` with **LangGraph.js** pre-oracle cognition (`perceive` → `plan` → `act`), **`xstate`** loop policy, a **swappable oracle bridge** (synthetic default, optional **process** adapter per [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md)), **SSE fanout** of turn, phase, and cognition trace events, and a small **HTTP API** (`POST /runs`, `POST /runs/:id/turns`, `GET /runs/:id/events`).
- **Web shell** (`apps/web`): Vite page that starts a run, opens SSE (`EventSource`), and provides an **interactive command** input (multi-turn **`POST /turns`**), optional **replay demo** (first checkpoint), and **stub autoplay** (deterministic command cycle, no LLM). Panels: **game terminal** (`#game-terminal`, CRT-style phosphor lane — player-facing transcript), optional **raw SSE log** (debug — toggle **Show raw SSE log**; reconcile/checkpoint envelopes appear here but are not duplicated into the game terminal by design), phase, reconcile, checkpoints, **accumulated cognition trace**, **agent structure** (Mermaid: LangGraph brain + XState control). **Persisted shell snapshot:** console + side panels (including game terminal text) are **saved in `localStorage`** (debounced); on refresh a **loading overlay** runs while the shell tries **`GET /runs/:id/checkpoints`** — if the server still has that **`runId`**, the UI restores from the snapshot and **reconnects SSE**; if the run is gone (**404**), the snapshot stays visible and a **new run** starts below. **Restore saved console snapshot** reapplies the last save without reconnecting SSE (refresh to reconnect). The status line under the run header reports **oracle mode** (from **`GET /health`**) and **SSE connection** state.
- **Tests**: Vitest contract, in-process acceptance (`tests/acceptance.test.ts`), and **HTTP acceptance** (`tests/http.acceptance.test.ts`) against a real listener on an ephemeral port.

**Dev API oracle selection:** With no env override, `npm run dev:server` **automatically** starts a **persistent** Fortran oracle when the repo-root **`./adventure`** binary exists (after `make adventure` from the repository root): one game process per HTTP `runId`, stdin fed across turns (see [`persistentFortranOracleBridge.ts`](apps/server/src/oracle/persistentFortranOracleBridge.ts)). If `./adventure` is missing, the server uses the **synthetic** oracle (`OK.`). Set **`ADV_V2_PROCESS_ORACLE_SCRIPT`** to force a **one-shot bridge script** subprocess instead (see [oracle subprocess IPC](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md); e.g. [`fixtures/oracle-fortran-bridge.mjs`](fixtures/oracle-fortran-bridge.mjs) or `fixtures/oracle-stub.mjs`). Set **`ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1`** to force synthetic even when `./adventure` exists (also set automatically for **`npm test`** / **`npm run test:cucumber`** so acceptance tests stay deterministic).

**Fortran oracle (CI + opt-in local):** GitHub Actions compiles the repo-root `./adventure` and runs `npm run test:oracle-fortran`, which exercises the **persistent** oracle against that binary (`tests/oracleFortran.ci.test.ts`). Locally: `make adventure` from the repo root, then the same npm script from `adventure-v2/`. **Default `npm test` does not** run `tests/oracleFortran.ci.test.ts` (see [`vitest.config.ts`](vitest.config.ts) exclude list).

**Not yet:** further deployment hardening (auth, rate limits, TLS termination).

### v1-like terminal MVP (slice 15)

The web shell includes a **game terminal** lane (human-readable): echoed commands (`>`), `[agent]` proposals, and plain oracle/Fortran output. The raw **SSE transcript** remains available for debugging (toggle **Show raw SSE log**).

**Fortran binary vs synthetic oracle:**

| Goal | Command |
|------|---------|
| Dev with real game text (when `./adventure` exists at repo root) | From repo root: `make adventure`, then from `adventure-v2/`: `npm run dev:server` — **persistent** Fortran oracle (no per-turn process restart) |
| Dev without building Fortran (synthetic `OK.` responses) | Do not build `./adventure`, or run `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1 npm run dev:server` |
| Explicit **one-shot** subprocess oracle script | `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs npm run dev:server` or `fixtures/oracle-stub.mjs` — overrides auto persistent mode |

CI exercises the persistent Fortran oracle via `npm run test:oracle-fortran` after `make adventure`.

**Remaining gaps vs a full “prod” MVP:** real **ModelAdapter** / SLM calls in **`plan`** (still stub prompts + digests), optional **XState snapshot** on the wire (today: phase transitions only), **LangGraph checkpointer** unification with **`CheckpointRegistry`**, and optional browser E2E (Playwright).

**Slice 12 (configurable CORS):** set comma-separated **`ADV_V2_CORS_ORIGINS`** on the server process to restrict browser `Origin` values that receive `Access-Control-Allow-Origin` (reflected origin per request). When unset or blank, behavior matches earlier slices: **`Access-Control-Allow-Origin: *`** on JSON, SSE, and `OPTIONS` responses. Covered in `tests/http.acceptance.test.ts`.

**Slice 13 (LangGraph + XState + trace observability):** Each turn runs through `@langchain/langgraph` (`packages/cognition/src/brain/runTurnBrainGraph.ts`) emitting **four** trace rows before/around reconcile (`perceive`, `plan`, `act`, plus post-oracle `reconcile`). Stub prompts live in `packages/cognition/src/prompts/`; **`plan`** traces include **`promptDigest`** / **`promptSummary`** for observability. **`packages/control`** uses **`xstate`** (`createMachine` + `createActor`) with an internal **`invalidRouting`** transient state for invalid-action escalation. **`POST /runs/:id/turns`** awaits async cognition (`processTurn`). One full turn yields **10** SSE wire events (4× `turn`, 4× `trace`, 2× `phase`); HTTP acceptance and Cucumber steps expect **10** events per turn. **`CognitionTraceWire`** adds optional **`graphNodeId`**, **`stepIndex`**, **`promptDigest`**, **`promptSummary`**, **`promptRole`**. Close-out: [`slice-13-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-13-multidisciplinary-review.md).

**Slice 14 (interactive shell + full plan prompts + stub autoplay):** Web UI command field and multi-turn play; **`plan`** traces may include full **`promptSystem`** / **`promptUser`** (capped by **`COGNITION_PROMPT_TEXT_MAX_CHARS`** in `packages/contracts/src/http/wire.ts`, enforced in `packages/cognition/src/brain/promptDigest.ts`). Stub autoplay in the browser loops **`POST /turns`** via `apps/web/src/stubAutoplayPlanner.ts` (no new HTTP routes). HTTP acceptance includes **two sequential turns** on one run. Close-out: [`slice-14-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-14-multidisciplinary-review.md).

**Slice 15 (virtual terminal lane):** Pure formatters in `apps/web/src/wireDisplay.ts` build a readable terminal transcript (`>` echo, `[agent]` line, oracle output); **`index.html`** / **`main.ts`** add **`#game-terminal`** and a **Show raw SSE log** checkbox. Close-out: [`slice-15-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-15-multidisciplinary-review.md).

**Slice 16 (CRT shell + diagrams + cognition log):** Phosphor/bezel styling around **`#game-terminal`** (VT323); **`appendCognitionTraceEntry`** keeps **plan** prompts visible alongside later **`reconcile`** traces (cap **`COGNITION_TRACE_CAP_CHARS`** in `wireDisplay.ts`). **Agent structure** panel renders **Mermaid**: LangGraph string from **`compiledBrainGraph.getGraph().drawMermaid()`** via **`npm run codegen:brain-mermaid`** → `brainGraphMermaid.generated.ts`; XState topology in **`agentDiagrams.ts`** with **`tests/agentDiagrams.test.ts`** guarding **`ControlPhase`** names. Stub autoplay runs **10** moves per click. **Dev shell:** optional **`config.cognitionProfile`** on **`POST /runs`** labels the run for benchmarks / future routing; **custom Mermaid** for LangGraph/XState can be edited and **saved in the browser** (`agentDiagramSettings.ts`) to compare agent plans without rebuilding—the **live** brain graph remains server-side until additional profiles are wired. Close-out: [`slice-16-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-16-multidisciplinary-review.md).

**Slice 18 (game terminal — oracle visibility):** **`gameTerminalTurnAppendFromWire`** (`gameTerminalBuffer.ts`) maps SSE **`turn`** events to CRT lines using **`vtChunk === null`** only for non-terminal kinds; **`oracle_observation`** with whitespace-only **`output`** formats to **`""`** but still appends so the wait placeholder clears. Covered in **`tests/gameTerminalBuffer.test.ts`**. Close-out: [`slice-18-multidisciplinary-review.md`](../.work-items/adventure-v2/slice-18-multidisciplinary-review.md).

**Slice 8 (R3 reconcile visibility):** `ReconcileOutcome` adds optional `correlationId`, `driftSummary`, and `evidence` (oracle outcome + capped output excerpt). Oracle turn payloads include optional `outcome` (`accepted` \| `rejected` \| `transport_error`); subprocess harness failures map to `transport_error` so reconcile uses `driftClass: "unknown"` vs validation-style `parser` rejection.

**Slice 9 (HTTP Gherkin):** `npm run test:cucumber` runs `@cucumber/cucumber` against `tests/features/http/*.feature` using the same HTTP+SSE helpers as `tests/http.acceptance.test.ts` (`tests/helpers/httpWire.ts`). Vitest remains the primary CI gate; Cucumber is an optional readability layer for wire scenarios.

**Slice 10 (R5 on HTTP wire):** `tests/http.acceptance.test.ts` asserts invalid-action escalation (`test` and `chaos` phases on SSE) after repeated `forceReject` turns; `tests/features/http/r5_invalid_action_recovery.feature` mirrors that path in Gherkin.

**Slice 11 (operational readiness):** `GET /health` returns `200` with `{ "status": "ok", "service": "adventure-v2", "oracleMode": "synthetic" \| "process", "processOracleScript": string | null }` (`processOracleScript` is basename-only when `oracleMode` is `process`). **`oracleMode`** reflects the same resolution as the CLI: explicit **`ADV_V2_PROCESS_ORACLE_SCRIPT`** uses **bridge_script** mode (basename of that script); else **auto-Fortran** when repo-root **`./adventure`** exists (**persistent** mode — basename **`adventure`**); else synthetic (`apps/server/src/oracle/oracleStartupConfig.ts`). JSON bodies on `POST` routes are capped at **256 KiB** (`HTTP_MAX_JSON_BODY_BYTES` in `apps/server/src/http/createServer.ts`); oversize requests get **`413`** with `{ "error": "payload_too_large", … }`. Covered in `tests/http.acceptance.test.ts`.

**Shell observability (game terminal):** `tests/gameTerminalWire.integration.test.ts` asserts one synthetic-oracle turn produces CRT-mappable SSE (`[agent] …`, `OK.`). The dev shell surfaces **`GET /health`** oracle hints and SSE status in-page; schema drift that breaks `parseSseWirePayload` logs **`[parse error]`** in the raw SSE panel and appends a short **`[wire]`** line to the game terminal.

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
| `GET` | `/health` | `200` liveness JSON: `status`, `service`, **`oracleMode`** (`synthetic` \| `process`), **`processOracleScript`** (basename or `null`) — matches resolved oracle (explicit env, auto-Fortran, or synthetic) |
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE** stream: `event: turn` / `event: phase` / `event: trace` with JSON payloads matching `SseWireEvent` |
| `GET` | `/runs/:runId/checkpoints` | `200` JSON array of `CheckpointRef` (empty until at least one turn completes) |
| `POST` | `/runs/:runId/replay` | Body `{ "checkpointId": string }` → `200` `{ ReplayRestorePayload }`; `404` `{ "error":"not_found" }` if the id is unknown or not for this run |

`POST` bodies that exceed **256 KiB** total bytes return **`413`** `{ "error": "payload_too_large", "message": … }` before JSON parsing.

`OPTIONS` is supported for CORS preflight. Default **`Access-Control-Allow-Origin: *`**. With **`ADV_V2_CORS_ORIGINS`** set (comma-separated exact origins), only matching request `Origin` values get a reflected `Access-Control-Allow-Origin`; disallowed origins omit that header on JSON, SSE, and `OPTIONS` responses.

## Local dev

This matches the **v1-style mental model**: start one stack and serve clients. The API holds **per-run session state** (`runId`) and wires each turn through cognition → **oracle / game runtime** → reconcile; browsers attach via **SSE** and **REST**.

### One command (recommended)

From `adventure-v2/` after `npm install`:

```bash
npm run dev
```

Starts **both** the HTTP API (default **8787**) and the web shell (**5173**). Open **http://localhost:5173** in the browser. Prefer **`localhost`** over **`127.0.0.1`** when navigating manually or with tools such as Chrome DevTools MCP — some setups only load the app reliably on `localhost`. (`curl` / **`GET /health`** can still use `127.0.0.1`.) Build the Fortran binary first if you want real room text (repository root):

```bash
make adventure
```

The API startup banner lists **Sessions / turns / SSE** routes and the resolved **game oracle** (`auto_fortran` when `./adventure` exists; otherwise synthetic).

### Split processes (optional)

API only (default port `8787`; bind `0.0.0.0`):

```bash
npm run dev:server
```

Web shell only (Vite, port `5173`):

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

## Troubleshooting: game terminal looks empty

Use this table before assuming a UI regression. The **game terminal** is `#game-terminal`; detailed envelopes (reconcile, checkpoint, full trace JSON) appear only under **Show raw SSE log**.

| Symptom | What to check |
|--------|----------------|
| Nothing appears after Send | Status line: **SSE: connected**? If **error**, confirm API is running and **`VITE_API_URL`** matches the server used for **`POST /runs`**. |
| Raw SSE shows events but CRT does not | Look for **`[parse error]`** in the raw panel — wire payload failed **`SseWireEvent`** validation; the game terminal also gets a **`[wire]`** meta line. Fix server contract or client schema. |
| Only `OK.` or terse text | Status line **Oracle: synthetic** — build repo-root **`./adventure`** and restart the API so auto-Fortran activates, or set **`ADV_V2_PROCESS_ORACLE_SCRIPT`** explicitly (see table above). |
| Looking for reconcile/checkpoint text | By design those **`turn`** kinds are **not** copied into the game terminal; use **raw SSE log**. |
| Expected room text after configuring Fortran | Confirm **`ADV_V2_PROCESS_ORACLE_SCRIPT`** is set on the **API process** (`npm run dev:server`), not the Vite process. |

### Verify `/health` matches oracle resolution

[`resolveOracleStartupConfig`](apps/server/src/oracle/oracleStartupConfig.ts) and **`GET /health`** use the same logic. Quick check while the API is up:

```bash
curl -sS http://127.0.0.1:8787/health
```

| On disk | Expected `oracleMode` | Notes |
|--------|------------------------|--------|
| Repo-root **`./adventure`** exists, auto-disable is off, **`ADV_V2_PROCESS_ORACLE_SCRIPT`** unset | `"process"` | **Persistent** oracle — `processOracleScript` is **`adventure`** |
| **`ADV_V2_PROCESS_ORACLE_SCRIPT`** set (non-empty path to a bridge `.mjs`) | `"process"` | **Bridge script** — `processOracleScript` is that file’s basename |
| **`./adventure` missing** (or **`ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1`**) | `"synthetic"` | `processOracleScript` is `null` |

Game text from Fortran never prints in the **`npm run dev`** terminal; it appears in the browser **game terminal** after SSE `oracle_observation` events.

### Autoplay vs cognition “agent”

**Autoplay** in the dev shell is a **deterministic stub**: it cycles fixed commands via [`stubAutoplayPlanner.ts`](apps/web/src/stubAutoplayPlanner.ts) and does **not** call an LLM. It exercises the same **`POST /turns`** + SSE path as manual play so you can watch multi-turn output quickly.

**Cognition** still runs each turn (LangGraph **`perceive` → `plan` → `act`** per architecture), but **`plan`** uses stub prompts/digests until a real **ModelAdapter** is wired. A future **LLM-driven autoplay** would be a separate feature (new planner or server endpoint), not the current button.

### Manual wire check

1. Start API + web (`npm run dev:server`, `npm run dev:web`).
2. Enable **Show raw SSE log**.
3. Send one command (e.g. `look`).
4. In raw SSE, confirm a **`turn`** envelope with **`oracle_observation`** and a string **`output`**.
5. In **game terminal**, confirm **`> look`**, **`[agent] look`**, then oracle text (**`OK.`** with the default synthetic oracle).

## Bootstrap plan (historical)

1. Define workspace/package manifests.
2. Add Cucumber-style behavior features (Gherkin) plus schema-first contract tests.
3. Add minimal server run lifecycle with synthetic fixtures.
4. Add web shell with transcript + state panel placeholders.
5. Wire cognition/control packages behind stable contracts.

## Testing strategy

**CI gate:** from this directory, `npm test` runs Vitest once (`vitest run`) over `tests/**/*.test.ts` but **`vitest.config.ts` excludes** `tests/oracleFortran.ci.test.ts`. GitHub Actions runs `npm audit` after `npm ci`, then `npm run test:cucumber` for HTTP Gherkin scenarios. `npm run test:oracle-fortran` uses [`vitest.oracle-ci.config.ts`](vitest.oracle-ci.config.ts) so only that file runs, with `ADV_V2_CI_FORTRAN=1`. The root workflow [`.github/workflows/adventure.yml`](../.github/workflows/adventure.yml) defines parallel **`adventure-v2`** and **`adventure-v3`** jobs; both install `gfortran` and run `make adventure` at the repo root. The **adventure-v2** job runs `npm run test:oracle-fortran` (along with the rest of the v2 suite).

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
| Fortran oracle (CI / opt-in) | `tests/oracleFortran.ci.test.ts` | **Persistent** oracle against built `./adventure`; run via `npm run test:oracle-fortran` (`vitest.oracle-ci.config.ts`) only. |
| Web helpers | `tests/wireDisplay.test.ts`, `tests/agentDiagrams.test.ts`, `tests/shellSessionPersistence.test.ts` | Transcript/cognition (`wireDisplay`); diagram guards (`agentDiagrams`); session snapshot shape (`shellSessionPersistence`). |

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
