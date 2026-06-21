# adventure-v2 — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation map (maintainers)

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../docs/client/index.md) | Play and evaluate surfaces |
| Features | [`docs/features/`](../docs/features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../docs/developer/index.md) | Maintainer setup and mdcp workflow |
| Glossary | [`docs/glossary/`](../docs/_build/client-v3.md#glossary) | Shared terms |
| Architecture | [`docs/architecture/`](../docs/architecture/overview.md) | Legacy flat design views |
| ADRs | [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md) | Decision history |

**Client package READMEs**: compiled from `docs/client/readme-adventure-*/` into `adventure-langgraph/`, `adventure-webclient/`, and `adventure-nl/`.

**Developer package READMEs**: compiled from `docs/developer/readme-adventure-*/` into `adventure-v2/`, `adventure-ag2/`, and nested packages.

Edit shards under those directories, then run `npm run docs:compile` from `docs/` (or `make docs-publish-readmes` from repo root).

See [mdcp workflow](../docs/_build/developer.md#mdcp-workflow) and [legacy docs](../docs/_build/developer.md#legacy-docs) for the full readme guide inventory.

## Overview

HTTP + SSE game API for benchmark-oriented adventure orchestration with LangGraph cognition stubs and XState loop control.

| Package | Role |
| --- | --- |
| `packages/contracts` | Turn/reconcile/checkpoint schemas + HTTP/SSE wire types |
| `apps/server` | `RunCoordinator`, oracle bridge, HTTP API, SSE fanout |
| `apps/web` | Vite dev shell — CRT game terminal, SSE panels, stub autoplay |
| `packages/cognition` | LangGraph turn brain (`perceive` → `plan` → `act`) |
| `packages/control` | XState loop policy and phase telemetry |

**Not yet:** deployment hardening (auth, rate limits, TLS termination), real ModelAdapter in `plan`, Playwright E2E.

Architecture: [`docs/architecture/adventure-v2/`](../docs/architecture/adventure-v2/overview.md).

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness JSON: `status`, `service`, **`oracleMode`**, **`processOracleScript`** |
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE**: `turn` / `phase` / `trace` with `SseWireEvent` payloads |
| `GET` | `/runs/:runId/checkpoints` | `200` JSON array of `CheckpointRef` |
| `POST` | `/runs/:runId/replay` | Body `{ "checkpointId": string }` → replay payload or `404` |

`POST` bodies over **256 KiB** return **`413`** `{ "error": "payload_too_large" }`.

`OPTIONS` supported for CORS. Default **`Access-Control-Allow-Origin: *`**. Set **`ADV_V2_CORS_ORIGINS`** (comma-separated) to restrict reflected origins.

One full turn yields **10** SSE wire events (4× `turn`, 4× `trace`, 2× `phase`).

## Oracle modes

See [Fortran oracle](../docs/_build/developer.md#fortran-oracle) for build steps.

| Goal | Command |
| --- | --- |
| Dev with real game text (`./adventure` at repo root) | `make adventure`, then `npm run dev:server` — **persistent** Fortran oracle |
| Dev without Fortran (synthetic `OK.`) | Do not build `./adventure`, or `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1 npm run dev:server` |
| Explicit one-shot bridge script | `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs npm run dev:server` |

Verify while API is up:

```bash
curl -sS http://127.0.0.1:8787/health
```

| On disk | Expected `oracleMode` | `processOracleScript` |
| --- | --- | --- |
| `./adventure` exists, auto on, no script env | `"process"` | `"adventure"` |
| `ADV_V2_PROCESS_ORACLE_SCRIPT` set | `"process"` | bridge basename |
| No binary or auto disabled | `"synthetic"` | `null` |

CI: `npm run test:oracle-fortran` after `make adventure`. Default `npm test` excludes Fortran CI test.

## Local dev

From `adventure-v2/` after `npm install`:

```bash
npm run dev
```

Starts API (**8787**) and web shell (**5173**). Open `<http://localhost:5173>`.

Split processes:

```bash
npm run dev:server   # API only
npm run dev:web      # Vite only
VITE_API_URL=http://127.0.0.1:9999 npm run dev:web
```

Optional CORS allowlist:

```bash
ADV_V2_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 npm run dev:server
```

#### Troubleshooting empty game terminal

| Symptom | Check |
| --- | --- |
| Nothing after Send | SSE connected? `VITE_API_URL` matches API used for `POST /runs` |
| Raw SSE but empty CRT | `[parse error]` in raw panel — wire schema mismatch |
| Only `OK.` | Oracle synthetic — build `./adventure` or set process script |
| Reconcile in CRT | By design not copied to game terminal — use raw SSE log |

**Autoplay** in the dev shell is a **deterministic stub** (`stubAutoplayPlanner.ts`), not an LLM.

## Testing

**CI gate:** `npm test` then `npm run test:cucumber`. Add `npm run test:oracle-fortran` after oracle edits.

| Layer | Role |
| --- | --- |
| Control / cognition | XState escalation; LangGraph trace order; prompt caps |
| Contracts | Schema regressions in `packages/contracts` |
| In-process acceptance | R1–R5 via `RunCoordinator` without HTTP |
| HTTP + SSE | `http.acceptance.test.ts` — real listener, matches web shell |
| HTTP Gherkin | `npm run test:cucumber` — optional readability layer |
| Fortran oracle | `npm run test:oracle-fortran` — opt-in / CI |

```bash
npm install
npm test
npm run test:cucumber
# optional after make adventure:
npm run test:oracle-fortran
```

See [Testing baseline](../docs/developer/readme-shards/testing-baseline.md).

## Related docs

- Oracle IPC: [`docs/architecture/adventure-v2/oracle-subprocess-ipc.md`](../docs/architecture/adventure-v2/oracle-subprocess-ipc.md)
- Process view: [`docs/architecture/adventure-v2/process-view.md`](../docs/architecture/adventure-v2/process-view.md)
- LangGraph CRT product shell: [`adventure-langgraph`](../adventure-langgraph/README.md)
