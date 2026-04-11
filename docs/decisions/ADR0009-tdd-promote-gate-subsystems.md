# ADR0009: TDD and promote-to-live gate for subsystems

## Context

### User needs and motivations

- **Authors** should not accidentally **break autoplay** with a syntax error or bad hook: changes need **verification** before they steer the live game.
- **Teams** want **regression safety**: the same **Red → Green → Refactor** discipline used in the repo applies to subsystem code.
- **“Deploy to frontend”** in this program means **promote a revision to live**, not a separate HTTP deployment—users need a **clear gate** (tests green) before promotion.

### Technical context

Subsystem code is user-authored JS ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)) stored in SQLite ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)) with revision history ([ADR0007](ADR0007-subsystem-revision-control-and-replay.md)).

The **live** dashboard path will run **browser-orchestrated glue and orchestration** ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)): subsystems plug into that loop. Tests should include **pure glue** tests (transcript slices, state) and **integration** tests that **mock** logical LLM HTTP (e.g. MSW) so promotion is never gated on real provider calls.

**State-machine tests:** Where autoplay uses an **XState** machine ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)), add tests that assert **allowed transitions** (for example idle → planning → submitting) under mocked SSE and HTTP, alongside glue pure-function tests.

## Decision

- Require **automated tests** to pass before a **candidate revision** can be **promoted** to the **live** runtime that drives **glue and cognition** in the browser ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)).
- Use **Vitest** for shared Node tests (packaging, pure helpers) and **Vitest browser** or **happy-dom** where appropriate for workspace harness tests; extend `npm test` / `check` so CI enforces green builds.
- UX: **Run tests** → all pass → **Promote** enabled; failed tests block promotion.

## Alternatives considered

- **Promote on save** — Rejected: violates TDD safety and user request to test before deploy.
- **Manual checkbox “I promise it works”** — Rejected as sole gate; optional in addition to tests only if legally required.
- **Server-side test execution only** — Rejected for fast iteration; client can run tests locally; CI still required for trunk.

## Consequences

**Positive**

- Fewer broken live sessions; clearer audit trail (tie test results to revision in SQLite).

**Negative**

- Authors must maintain tests; empty test suite policy must be defined (fail closed vs open).

## Rationale

User explicitly requested **TDD** and running tests **before deploying** subsystem changes to the live front end; a promote gate encodes that contract.

## Status

Proposed

## References

- `adventure-llm/package.json` (scripts)
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) (`promotion_records` and store API — see ADR **Implementation**)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) (`materializeReplayFiles`, `appendRevisionReverting`, tags — see ADR **Implementation**; **Run tests** then **Promote** UX still forward work)
- [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md)
