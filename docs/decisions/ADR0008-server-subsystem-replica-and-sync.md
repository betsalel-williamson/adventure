# ADR0008: Server subsystem replica and sync on connect

## Context

### User needs and motivations

- **Users** expect **backups**: if the browser profile is cleared or they switch machines, subsystem work should be **recoverable** from the server.
- **Operators** want a **single place** to inspect or archive what was promoted or synced (compliance, debugging).
- **Authors** should not manually “export files” for every session; **sync on connect** should make the server catch up automatically when possible.

### Technical context

The client SQLite database is **authoritative** ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)). The server maintains a **replica** (e.g. `better-sqlite3` under `adventure-llm`, similar to `benchmarkRunsDb.ts`).

## Decision

- After session establishment (`/api/session` or equivalent), run a **subsystem sync** phase: client sends **workspace id**, **last acked revision**, and **deltas** (WAL frames, batched events, or full export if divergence).
- Server applies updates **idempotently** and returns acknowledgment / `server_head_revision` for diagnostics.
- **Default push policy**: when client and server share a **linear** history, **client wins** on push (server does not overwrite newer client revisions with stale server rows).

### Forks, data loss, and multi-device

- **Client data loss** (storage cleared before a successful sync): the server replica may hold the **last good backup**—on connect, detect **client empty / behind server** and offer **restore from server** (explicit user action), not silent overwrite.
- **Split-brain** (two devices or browsers both edited offline): **server head may not be an ancestor of client head**. Do **not** silently “client wins” if that would discard server-only revisions. **Minimum UX:** detect fork → prompt **“Keep local / Pull server / Merge later”** (merge can be v2); store **per-revision metadata** (parent id, monotonic clock or **vector** summary) so forks are detectable.
- **Idempotency:** sync batches carry **client revision ids**; retries must not double-apply.

## Alternatives considered

- **Server-authoritative merge** — Rejected for v1; contradicts stated client authority and complicates offline editing.
- **Manual export/import only** — Rejected as primary path; acceptable as fallback when sync fails.
- **Real-time continuous sync** — Optional later; **on connect** satisfies the stated requirement with less moving parts.
- **Silent client-wins always** — Rejected for multi-device fork cases; narrowed to **linear-history** pushes only.

## Consequences

**Positive**

- Backup path without changing author workflow.
- Server can implement quotas and audit logs later.

**Negative**

- Must handle **offline queue**, retries, and partial failures with visible UI state (“sync pending”).

## Rationale

User required **WAL SQLite** with **client authoritative** data and **sync to backend on connect**; a replica plus idempotent apply matches that model.

## Status

Proposed

## References

- `adventure-llm/src/cli/benchmarkRunsDb.ts`
- `adventure-llm/src/cli/webDashboardSession.ts`
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)
