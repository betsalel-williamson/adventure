---
name: adventure-v2-slice-6-r4-cognition-trace
overview: "Emit or surface structured cognition / LangGraph-shaped trace data on the existing SSE wire and render it in the web shell—minimal additive contracts, TDD against RunCoordinator and HTTP acceptance, without shipping full LangGraph runtime."
todos:
  - id: contracts-trace
    content: Add cognition trace wire types in packages/contracts + schema tests
    status: pending
  - id: server-sse
    content: Extend RunCoordinator / SSE emission (createServer) for new event kind(s); HTTP tests
    status: pending
  - id: web-panels
    content: wireDisplay + index.html panel + Vitest for parse/format
    status: pending
isProject: false
---

# Adventure v2 — Slice 6 (R4 cognition trace)

## Goal

Deepen [R4](./user-story.md) beyond Slice 5 panels: the benchmark engineer **SHALL** see **cognition / graph-shaped activity** (node or step identifiers and short payloads) alongside the terminal transcript and control-phase timeline, using the **existing HTTP + SSE** transport.

## Scope

- [`packages/contracts`](../../adventure-v2/packages/contracts): smallest additive **wire event** variant or envelope fields for trace lines (align naming with `SseWireEvent` / `sseWireEventSchema`).
- [`apps/server`](../../adventure-v2/apps/server): `RunCoordinator` and/or [`createServer.ts`](../../adventure-v2/apps/server/src/http/createServer.ts) emit ordered trace events **when the coordinator has trace data**; if the synthetic path has no graph yet, emit **deterministic stub trace lines** for one turn so the UI and HTTP tests have stable fixtures (TDD—failing HTTP test first).
- [`apps/web`](../../adventure-v2/apps/web): extend [`wireDisplay.ts`](../../adventure-v2/apps/web/src/wireDisplay.ts), [`main.ts`](../../adventure-v2/apps/web/src/main.ts), and [`index.html`](../../adventure-v2/apps/web/index.html) with a **cognition trace** panel.
- [`tests`](../../adventure-v2/tests): contract round-trip, [`http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts) for at least one trace event on the wire, [`wireDisplay.test.ts`](../../adventure-v2/tests/wireDisplay.test.ts) for formatting.

## Non-goals

- Production deployment hardening; Fortran oracle in CI; wiring `@cucumber/cucumber` as runner.
- Full LangGraph runtime or persistence—only **observability contracts** and **thin emission** suitable for later cognition package integration.

## Verification

`cd adventure-v2 && npm test`; optional `npm run dev:server` + `npm run dev:web` smoke.

## References

- Previous slice: [Slice 5 plan](../../.cursor/plans/adventure-v2-slice-5-r4-web-observability.plan.md) (may live under Cursor submodule when checked out).
- Testing strategy: [adventure-v2 README](../../adventure-v2/README.md) (Testing strategy section).
