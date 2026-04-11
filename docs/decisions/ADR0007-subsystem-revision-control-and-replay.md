# ADR0007: Subsystem revision control, tags, and replay

## Context

### User needs and motivations

- **Experimenters** need **best-practice version control**: immutable history, named checkpoints, and the ability to **return** to a known-good subsystem when a change breaks autoplay.
- **Debugging** requires **time travel**: “run cognition as-of revision R” to compare model outputs or game traces.
- **Collaboration** (future) benefits from **tags** and exportable revision bundles without pretending the browser is full Git.

### Technical context

Revision data lives in the client SQLite store ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md); **Implementation** lists schema paths under `adventure-lm/src/browser/`). **Tags**, **replay materialization**, and **non-destructive revert** are implemented in that module (see **Implementation** below). **Dashboard UX** (history list, diffs, tag management UI) and orchestration wiring (run tests as-of `revision_id`, then promote per [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)) remain forward work on top of the store API.

**Cognition replay:** “Run cognition as-of revision R” ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)) combines **subsystem file tree at R** with **game/trace inputs**; inferred glue state may be reconstructed from checkpoints + transcript tail per ADR0005 mitigations, not assumed identical to live Fortran truth without validation.

**Event-oriented replay:** Where fidelity matters, prefer a **typed event log** (SSE markers, planner phases, GETIN lines) alongside snapshots; a single **actor** or state machine as the cognition hub ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)) makes “replay the same event sequence” a first-class story.

## Decision

- Use **monotonic revisions** per workspace (integer or ULID); each commit records changed files and a **parent** pointer. Start with a **linear** mainline; a DAG is optional later.
- Support **tags** as named pointers to a revision (e.g. `release-2026-04`, `baseline-before-map-change`).
- **Replay**: materialize the file tree at `revision_id`, optionally run tests, optionally **promote** to live ([ADR0009](ADR0009-tdd-promote-gate-subsystems.md)).
- **Revert**: never rewrite history; add a new revision that applies the inverse change.

## Alternatives considered

- **Force-reset / destructive rewrite** — Rejected: breaks audit and sync ([ADR0008](ADR0008-server-subsystem-replica-and-sync.md)).
- **Only named snapshots without numeric lineage** — Rejected: insufficient for ordered replay and diffs.
- **Full Git repository in OPFS** — Deferred: high complexity; explicit revision rows suffice for v1.

## Consequences

**Positive**

- Clear UX for “go back to this revision” and compare runs.
- Sync protocol can key off **revision counters** instead of wall clock.

**Negative**

- UI work for history, diff, and tag management (store APIs exist; presentation does not).

## Rationale

User asked for VC **best practices** and **replay**; linear immutable revisions with tags are the smallest model that satisfies audit and debugging needs.

## Implementation

**Location (package [`adventure-lm`](../../adventure-lm/)):**

| Capability | Store API (see [`subsystemWalStore.ts`](../../adventure-lm/src/browser/subsystemWalStore.ts)) |
| ---------- | ------------------------------------------------------------------------------------------------ |
| **Tags** | `putRevisionTag`, `getRevisionTag`, `listRevisionTags`, `deleteRevisionTag` |
| **Replay (materialize tree at R)** | `materializeReplayFiles` (same snapshot as `getFilesAtRevision`; explicit entry for cognition orchestration) |
| **Revert (no history rewrite)** | `appendRevisionReverting` — appends a revision that restores paths touched in a given revision to their **parent-of-that-revision** state |
| **Lineage helper** | `getParentRevisionId` |

**Schema:** `revision_tags` table (migration v2 in [`subsystemWalStoreMigrations.ts`](../../adventure-lm/src/browser/subsystemWalStoreMigrations.ts)); `SUBSYSTEM_WAL_STORE_SCHEMA_VERSION` is **2**.

**Tests:** [`subsystemWalStore.test.ts`](../../adventure-lm/src/browser/subsystemWalStore.test.ts) (ADR0007 behaviors under describe `subsystemWalStore revision tags and replay`).

**Not in this slice:** workspace/dashboard UI for tags and history, `BroadcastChannel` notifications for tag changes ([ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md)), and glue **event** replay beyond subsystem file trees ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)).

## Status

Accepted

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)
