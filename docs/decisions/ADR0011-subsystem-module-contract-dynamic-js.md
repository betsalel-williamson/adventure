# ADR0011: Subsystem ES module contract and dynamic loading

## Context

### User needs and motivations

- **Authors** want to write **plain JavaScript** subsystems that plug into **browser-orchestrated glue and policy** ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md))—map/inventory/mode hooks, prompt shaping—with a **small, documented API**—not fork the whole `adventure-llm` repo.
- **Security-conscious operators** need **sandboxing**: user code must not access Node or arbitrary browser capabilities.
- **Testability** ([ADR0009](ADR0009-tdd-promote-gate-subsystems.md)) requires a **stable contract** so tests can mock hooks and assert behavior.

### Technical context

Subsystem sources live in SQLite ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)) and are **materialized** for execution. Optional TypeScript authoring is a separate ADR ([ADR0012](ADR0012-optional-ts-transpile-subsystem-authoring.md)).

Hooks execute in the **sandboxed** contexts below; the **orchestration loop** that calls them lives in the privileged dashboard code path ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)). Integration tests should **mock** logical LLM traffic (e.g. MSW) per ADR0005 / [ADR0009](ADR0009-tdd-promote-gate-subsystems.md).

**Root actor boundary:** Implement the privileged loop as a **single coordinator** that sends **typed messages** into the sandbox and receives **typed results**—the same mental model as `postMessage`, aligned with [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) actor-centric orchestration and easier to test than unstructured callbacks.

**Same-origin XSS:** **Pasteable** or **third-party shared** subsystem code must **not** run with access to **cookies**, **storage**, or the **dashboard DOM** on the app origin.

## Decision

- Define a **versioned subsystem module contract**: exported async functions (e.g. hooks for planner prompt body, game text handling) with explicit **input/output types** shared as JSDoc or `.d.ts` shims.
- **Do not** execute user subsystem code via **`import(blobUrl)` on the main thread** alongside the dashboard.
- Run cognition in an **isolated execution context**:
  - **Dedicated Web Worker** with **no** DOM and **no** direct storage access; **only** `postMessage` to the main thread / DB owner for I/O, **or**
  - **`iframe` with strict `sandbox`** (e.g. `sandbox="allow-scripts"` **without** `allow-same-origin`) so the document is **not** same-origin to the app—**message passing only** for effects.
- **Dynamic `import()`** of materialized sources remains valid **inside** that worker or sandboxed realm, not in the privileged UI thread.
- **Invalidate** module cache on **promote** ([ADR0007](ADR0007-subsystem-revision-control-and-replay.md), [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)).

## Alternatives considered

- **Plain `eval` in main window** — Rejected: unsafe and hard to test.
- **Fixed plugin list bundled in main app** — Rejected: blocks live authoring goals.
- **WASM plugins only** — Rejected for v1 complexity; JS matches “simple javascript system.”

## Consequences

**Positive**

- Clear extension point; contract tests stabilize refactors.

**Negative**

- Sandbox boundary debugging is harder; error surfaces must be user-friendly.

## Rationale

A **thin contract** plus **dynamic ES modules** matches user goals for editable subsystems and integrates with revision + promote flows.

## Status

Proposed

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) (file revisions persisted via store module — see ADR **Implementation**)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) (materialize-at-revision, tags — see ADR **Implementation**)
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)
