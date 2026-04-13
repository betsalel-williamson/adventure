# ADR0012: Optional in-browser TypeScript for subsystem authoring

## Context

### User needs and motivations

- **Some authors** prefer **TypeScript** for typesafe hooks and refactors in the Monaco workspace ([ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md)).
- **Others** want **zero compile step** and minimal bundle size—**JavaScript + JSDoc** should remain the default ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)).

### Technical context

Transpilation in the browser can use **`typescript.transpileModule`** in a **Worker**, or **esbuild-wasm** for larger trees. Both add payload and CPU cost.

Compiled subsystems remain **inputs to the browser glue/orchestration** story ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)); TS does not change the server/client boundary for **natural language model** packaging ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)). Transpiled hooks use the **same** subsystem contract and orchestration **events** as JavaScript ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md))—no second on-the-wire protocol for the cognition actor.

## Decision

- **Default**: subsystem authoring is **JavaScript** with **JSDoc** for IntelliSense in Monaco.
- **Optional** (feature-flagged): allow `.ts` files in the workspace; transpile in a **Worker** before dynamic import; store **both** source and last-known-good emit in the client SQLite subsystem store ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)) **or** emit on the fly only—**finalize** with performance tests.
- If TS support is deferred, this ADR remains **proposed** until JS contract is stable.

## Alternatives considered

- **TS required everywhere** — Rejected: conflicts with “simple javascript system” and raises barrier.
- **Server-side TS compile only** — Rejected for offline/local-tab editing goals unless paired with sync; optional hybrid later.
- **esbuild-wasm only** — Viable; heavier download; choose per measured bundle budget.

## Consequences

**Positive**

- Better DX for type-heavy subsystems without forcing all users to compile.

**Negative**

- Two authoring paths to test; source maps and error line mapping add complexity.

## Rationale

User asked whether TS in the client is easy enough; this ADR captures a **conscious, optional** path without blocking the JS-first baseline.

## Status

Proposed

## References

- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) (subsystem persistence)
- [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md)
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)
- **See also:** [ADR0016](ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md) — Glue MCP registry vs subsystem hooks.
