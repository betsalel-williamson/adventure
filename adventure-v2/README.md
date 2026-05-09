# adventure-v2

Planned v2 runtime for benchmark-oriented adventure orchestration.

## Scope in this phase

- Documentation plus a **minimal in-repo vertical slice**: contracts (`packages/contracts`), synthetic run coordinator (`apps/server`), control + cognition stubs, Vitest acceptance tests that mirror R1–R5 Gherkin feature files.
- **Not yet:** HTTP/SSE APIs, real oracle process bridge, Cucumber CLI wiring, or web UI (see Bootstrap plan steps 4 onward).

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

## Bootstrap plan

1. Define workspace/package manifests.
2. Add Cucumber-style behavior features (Gherkin) plus schema-first contract tests.
3. Add minimal server run lifecycle with synthetic fixtures.
4. Add web shell with transcript + state panel placeholders.
5. Wire cognition/control packages behind stable contracts.

## Testing principles

- Use Cucumber-style BDD as the acceptance layer and TDD as the implementation loop.
- Keep feature files focused on observable benchmark behaviors (replay, drift, loop transitions).
- Map each feature to deterministic fixtures and typed step helpers.

## Verification

From this directory:

```bash
npm install   # once
npm test      # Vitest — contract + acceptance tests (`tests/`)
```
