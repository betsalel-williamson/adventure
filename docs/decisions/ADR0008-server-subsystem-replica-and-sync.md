# ADR0008: Server subsystem replica and sync on connect

## Context

### User needs and motivations

- **Users** expect **backups**: if the browser profile is cleared or they switch machines, subsystem work should be **recoverable** from the server.
- **Operators** want a **single place** to inspect or archive what was promoted or synced (compliance, debugging).
- **Authors** should not manually “export files” for every session; **sync on connect** should make the server catch up automatically when possible.

### Technical context

The client SQLite database is **authoritative** ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) — store module and migrations in `adventure-lm/src/browser/`). **Tag rows** (`revision_tags`, [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)) are part of the same client-originated state and should replicate with subsystem revisions in sync batches. The server maintains a **replica** (e.g. `better-sqlite3` under `adventure-lm`, similar to `benchmarkRunsDb.ts`).

If **inferred glue checkpoints** are stored in that client DB ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md), [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)), sync batches should treat them like other client-originated rows: **idempotent** apply, clear conflict rules, and optional **privacy/size** limits if glue snapshots grow large.

**Orchestration UX:** **Sync pending / complete / fork** should be **explicit states or events** in the dashboard cognition loop ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)), not a single hidden flag—so they compose with LLM progress and engine I/O the same way subsystem promote events do.

## Decision

- After session establishment (`GET /api/session` or equivalent), run a **subsystem sync** phase: client sends **workspace id**, **client head revision id**, and a batch of **revisions** (explicit revision ids, parent ids, file deltas, optional **`revision_tags`** and **`promotion_records`** payloads—same schema as the client store).
- Server applies updates **idempotently** via **`POST /api/subsystem-sync`** (see **Implementation**) and returns a structured result including **`serverHeadRevisionId`** and **`status`**: **`applied`**, **`noop`** (including **client behind server** when the batch is empty), or **`fork`** (non-linear history).
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

## Implementation

**Location (package [`adventure-lm`](../../adventure-lm/)):**

| Area | Path |
| ---- | ---- |
| Sync batch apply (linear push, fork detection, idempotent retries, behind-server noop) + HTTP body parser + workspace id validation | [`adventure-lm/src/cli/subsystemServerSync.ts`](../../adventure-lm/src/cli/subsystemServerSync.ts) |
| Vitest (apply, fork, behind, tags) | [`adventure-lm/src/cli/subsystemServerSync.test.ts`](../../adventure-lm/src/cli/subsystemServerSync.test.ts) |
| **`POST /api/subsystem-sync`** route (session cookie; same `/api` session resolution as other dashboard JSON routes) | [`adventure-lm/src/cli/webDashboard.ts`](../../adventure-lm/src/cli/webDashboard.ts) |
| HTTP integration test | [`adventure-lm/src/cli/webDashboard.test.ts`](../../adventure-lm/src/cli/webDashboard.test.ts) |
| Client `fetch` helper | [`adventure-lm/public/dashboardApi.js`](../../adventure-lm/public/dashboardApi.js) (`postSubsystemSync`) |

Replica databases use the **same migrations** as the client store ([`subsystemWalStoreMigrations.ts`](../../adventure-lm/src/browser/subsystemWalStoreMigrations.ts)) via `SubsystemWalStore` / `migrateSubsystemWalStore`. Default directory: **`adventure-lm/.cache/subsystem-replica/<workspaceId>.db`**. Override with env **`ADVENTURE_LM_SUBSYSTEM_REPLICA_DIR`** (absolute or resolved path for the **directory** containing `<workspaceId>.db` files).

**Not in this slice:** browser-side **calling** sync after session (orchestration / XState events for **sync pending / complete / fork** per ADR0005), **restore-from-server** download of a full replica into the client, and **glue snapshot** rows in sync batches (schema for glue in client DB still optional per ADR0006).

## Status

Accepted

## References

- `adventure-lm/src/cli/benchmarkRunsDb.ts`
- `adventure-lm/src/cli/webDashboardSession.ts`
- [`API_DOCUMENTATION.md`](../../API_DOCUMENTATION.md) — `POST /api/subsystem-sync`
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)
