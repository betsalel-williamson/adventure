# adventure-llm cognition redesign — ADR index

This index links the split decisions for the thin-backend + browser cognition + subsystem workspace program. Each ADR is a single decision or feature extension.

**Phase 0 (first):** Update and extend **architecture documentation** so the target direction is clear alongside the as-built docs—see [`docs/architecture/adventure-llm-cognition-and-workspace.md`](../architecture/adventure-llm-cognition-and-workspace.md), [`docs/architecture/overview.md`](../architecture/overview.md), and the **Direction of travel** note in [`docs/architecture/adventure-engine.md`](../architecture/adventure-engine.md). Then implement ADRs below.

**Suggested implementation order** (dependencies first):

1. [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — Backend LLM packaging and discovery API  
2. [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — Browser-orchestrated autoplay: **glue** (map, inventory, modes, heuristics) and client state; engine + dat stay server-side  
3. [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) — Client-authoritative SQLite WAL subsystem store  
4. [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) — Subsystem revision control, tags, and replay  
5. [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) — Server subsystem replica and sync on connect  
6. [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — TDD and promote-to-live gate for subsystems  
7. [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) — Monaco workspace second tab and cross-tab sync  
8. [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md) — Subsystem ES module contract and dynamic loading  
9. [ADR0012](ADR0012-optional-ts-transpile-subsystem-authoring.md) — Optional in-browser TypeScript for subsystem authoring  

Parent planning context: Cursor plan `thin_backend_vs_code_prompts_074321ee` (see `.cursor/plans/` or linked PRs).

**Map from plan workstreams (informal):**

| Plan theme | ADRs |
|------------|------|
| Logical LLM API + packaging registry | ADR0004 |
| Browser autoplay / glue + client cognition loop | ADR0005 |
| SQLite WAL + VC + replay + sync | ADR0006, ADR0007, ADR0008 |
| TDD + promote gate | ADR0009 |
| Monaco second tab + BroadcastChannel | ADR0010 |
| Subsystem JS contract + sandbox | ADR0011 |
| Optional TS in browser | ADR0012 |

Related prior ADRs: [ADR0001](ADR0001-adventure-llm-text-llm-providers.md), [ADR0002](ADR0002-constructive-llm-prompt-phrasing.md), [ADR0003](ADR0003-scoped-object-hints-latest-room-block.md).
