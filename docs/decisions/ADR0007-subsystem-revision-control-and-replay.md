# ADR0007: Subsystem revision control, tags, and replay

## Context

### User needs and motivations

- **Experimenters** need **best-practice version control**: immutable history, named checkpoints, and the ability to **return** to a known-good subsystem when a change breaks autoplay.
- **Debugging** requires **time travel**: “run cognition as-of revision R” to compare model outputs or game traces.
- **Collaboration** (future) benefits from **tags** and exportable revision bundles without pretending the browser is full Git.

### Technical context

Revision data lives in the client SQLite store ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)). This ADR defines the **VC semantics**, not the storage engine.

**Cognition replay:** “Run cognition as-of revision R” ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)) combines **subsystem file tree at R** with **game/trace inputs**; inferred glue state may be reconstructed from checkpoints + transcript tail per ADR0005 mitigations, not assumed identical to live Fortran truth without validation.

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

- UI work for history, diff, and tag management.

## Rationale

User asked for VC **best practices** and **replay**; linear immutable revisions with tags are the smallest model that satisfies audit and debugging needs.

## Status

Proposed

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)
