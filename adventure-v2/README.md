# adventure-v2

Planned v2 runtime for benchmark-oriented adventure orchestration.

## Scope in this phase

- **Contracts** (`packages/contracts`): turn/reconcile/checkpoint schemas plus **HTTP/SSE wire types** (`CreateRunRequest`, `SseWireEvent`, …).
- **Server** (`apps/server`): `RunCoordinator` with a **swappable oracle bridge** (synthetic default), **SSE fanout** of turn + phase events, and a small **HTTP API** (`POST /runs`, `POST /runs/:id/turns`, `GET /runs/:id/events`).
- **Web shell** (`apps/web`): minimal Vite page that starts a run, issues a sample turn, and reads the SSE stream (`EventSource`).
- **Tests**: Vitest contract, in-process acceptance (`tests/acceptance.test.ts`), and **HTTP acceptance** (`tests/http.acceptance.test.ts`) against a real listener on an ephemeral port.

**Not yet:** real external oracle process bridge, production deployment hardening.

### Cucumber / Gherkin CLI

Feature files under `tests/features/` remain the behavioral spec reference. **Cucumber is not wired** as a second test runner in this package; **`npm test` (Vitest)** is the automated gate. Optional future work: add `@cucumber/cucumber` with step definitions that call the HTTP API.

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

## HTTP API (slice 2)

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE** stream: `event: turn` / `event: phase` with JSON payloads matching `SseWireEvent` |

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

## Bootstrap plan (historical)

1. Define workspace/package manifests.
2. Add Cucumber-style behavior features (Gherkin) plus schema-first contract tests.
3. Add minimal server run lifecycle with synthetic fixtures.
4. Add web shell with transcript + state panel placeholders.
5. Wire cognition/control packages behind stable contracts.

## Testing principles

- Use Cucumber-style BDD as the **spec** layer; Vitest implements the TDD loop.
- Keep feature files focused on observable benchmark behaviors (replay, drift, loop transitions).
- Map each feature to deterministic fixtures and typed step helpers.

## Verification

From this directory:

```bash
npm install   # once
npm test      # Vitest — contract + acceptance + HTTP tests (`tests/`)
```
