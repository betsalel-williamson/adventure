# ADR0010: Monaco workspace second tab and cross-tab sync

## Context

### User needs and motivations

- **Authors** want a **full editing surface** (multi-file, syntax-aware) **without losing** the game dashboard: a **separate tab** keeps layout calm and supports two monitors.
- **Users** expect edits in the editor tab to **show up live** in the game tab after passing the **promote gate** ([ADR0009](ADR0009-tdd-promote-gate-subsystems.md))—shared **session**, not two disconnected apps.
- **Operators** need both tabs to reflect the **same workspace id** and **same SQLite-backed state** ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)).

### Technical context

Monaco Editor is the practical “VS Code–like” surface without hosting full VS Code. Cross-tab coordination uses **BroadcastChannel**; same-origin tabs share cookies ([`webDashboardSession.ts`](../../adventure-llm/src/cli/webDashboardSession.ts)).

**SQLite access:** See [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)—**OPFS** implies a **single DB owner** (`SharedWorker` **or** exclusive writer tab). **BroadcastChannel** is for **events** (e.g. promoted revision, head changed), **not** a substitute for safe concurrent SQLite access.

**Cognition hub:** **`BroadcastChannel`** messages (promote, head changed, draft notifications) map cleanly to **external events** on the same **orchestration actor** that handles SSE and logical LLM calls ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)); they remain **non-authoritative** relative to the SharedWorker’s DB ownership ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)).

**Why not `sessionStorage` for glue:** [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) rejects **sessionStorage** / **localStorage** as the authoritative store for **inferred map, inventory, modes** — per-tab isolation breaks Dashboard ↔ Workspace coherence, volatility on tab close defeats durable workspace expectations, and ~5MB caps are too small. **Ephemeral UI** (panel state) may still use `sessionStorage`; **cognitive glue** follows SQLite + OPFS per ADR0006.

## Decision

- Provide a **dedicated route** (e.g. `public/workspace.html` + `workspace.js`) opened via **“Open workspace in new tab”** (`window.open` or `target=_blank`).
- Both tabs share the **session cookie** and **workspace identity**; **persistent state** is read/written only through the **single owner** pattern in ADR0006 (worker or exclusive writer).
- Use **`BroadcastChannel`** (scoped by session/workspace id) to notify the dashboard when a revision is **promoted** so the **live** subsystem reloads; optional messages for draft UI sync.
- **Hot swap** applies to **promoted** revisions, not every keystroke, to align with [ADR0009](ADR0009-tdd-promote-gate-subsystems.md).

## Alternatives considered

- **Monaco embedded only in main dashboard** — Rejected for UX goals (clutter, small pane).
- **code-server / Theia** — Rejected for v1 weight and ops; revisit if extension parity is required.
- **`localStorage` events for sync** — Rejected for payload size; SQLite is canonical; BC is for notifications.
- **Each tab opens its own OPFS SQLite connection** — Rejected by default (see ADR0006); use worker or single writer.

## Consequences

**Positive**

- Familiar two-tab workflow; minimal server changes (static page).

**Negative**

- Must handle tab lifecycle (one tab closed, refresh, service worker if added later).

## Rationale

User asked for a **VS Code–like** editor in a **different tab** with **shared session** and **live** updates; Monaco + BroadcastChannel + shared SQLite satisfies that without a second backend.

## Status

Proposed

## References

- `adventure-llm/public/index.html`
- `adventure-llm/src/cli/webDashboardSession.ts`
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) (subsystem store + `subsystemWalChannel` broadcast name/shapes)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) (tags/replay in store; **BroadcastChannel** tag notifications not yet defined—extend message union when wiring workspace UI)
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)
