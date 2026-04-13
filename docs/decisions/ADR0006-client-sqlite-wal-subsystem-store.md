# ADR0006: Client-authoritative SQLite WAL subsystem store

## Context

### User needs and motivations

- **Authors** need **durable** workspace history: crashes should not lose subsystem files; they need a familiar **append-only** mental model for “what changed.”
- **Power users** want to **replay** and **audit** past behavior (which revision was live when a run succeeded or failed).
- **Operators** need a clear **authoritative** copy: the **browser** is the writer; the server is a **replica** for backup ([ADR0008](ADR0008-server-subsystem-replica-and-sync.md)).

### Technical context

IndexedDB-only blob storage lacks relational queries for revisions, tags, and file trees. SQLite **WAL mode** supports durability semantics and aligns with server-side SQLite already used elsewhere in the package (e.g. benchmark DB patterns).

**OPFS and multi-tab:** Durable, high-performance setups use **OPFS** (often with **Access Handles**). OPFS/SQLite WASM typically implies **exclusive write** semantics—**two browser tabs must not each hold a direct read/write connection** to the same OPFS database without risking lock errors or corruption.

**Glue state (dashboard):** [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) requires **durable checkpointing** of **inferred** cognitive state (map, inventory model, modes, etc.) on refresh/reconnect—not `sessionStorage`. That state should use the **same persistence story** as subsystems (this ADR): SQLite + OPFS/IndexedDB, single owner pattern below, so Dashboard and Workspace stay consistent and multi-tab safe.

**Orchestration alignment:** Checkpoint writes should stay **ordered** with cognition phases (after a committed GETIN + applied plan). An **XState-style** orchestration hub ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) forward work) can invoke “persist glue snapshot” as an **effect** on the same transitions that advance LLM steps, avoiding races between async LLM calls and DB writes.

## Decision

- Store subsystem **files**, **revisions**, **metadata**, and **test/promotion records** in a **client-side SQLite** database opened in the browser via a **WASM** stack (e.g. wa-sqlite + OPFS, or sql.js with persistence). The **schema, migrations, and store API** are implemented in-repo (see **Implementation** below); **Vitest** exercises the same SQL and WAL behavior via **`better-sqlite3`** on a temp file. **Browser** integration loads WASM SQLite, runs the exported migration SQL, and attaches to OPFS (or chosen VFS)—that wiring is **forward work**, not duplicated here.
- **Optionally extend the same database** (or a clearly versioned sibling schema) to persist **inferred glue snapshots** and reconnect cursors per [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — exact tables TBD; principle is **one durable store**, not parallel ad-hoc browser storage.
- Enable **WAL** where the chosen stack supports it; checkpoint semantics inform replay and sync.
- Treat this database as the **source of truth** for subsystem content; server replica is derived.

### Single connection ownership (dashboard + workspace tabs)

- **Recommended (multi-tab safe):** Hold the **only** SQLite/OPFS connection in a **`SharedWorker`** (or equivalent single long-lived worker). **All** DB operations go through **`postMessage`** to that worker; tabs receive **replica snapshots / revision events** back. Optional **`BroadcastChannel`** can fan out notifications, but **not** replace the worker as the DB owner.
- **Acceptable MVP (simpler):** **Workspace tab is the exclusive writer** (only tab that opens the write-capable DB connection); **Dashboard tab** is a **read-only consumer** updated via **`BroadcastChannel`** (promote, head revision) and/or **snapshot payloads**, and must **not** open a second SQLite connection to the same OPFS path. Document that certain flows require the workspace tab to be open.

## Alternatives considered

- **IndexedDB key-value only** — Rejected: weak query story for VC metadata and cross-file revision bundles.
- **Server-authoritative subsystems** — Rejected: conflicts with offline editing and “edit live without deploy” goals; increases latency for every save.
- **Git binary in WASM** — Rejected for v1: heavier; SQLite + explicit revision rows match sync protocol needs with less surface area.
- **Independent SQLite connections in Dashboard and Workspace tabs** — Rejected for OPFS-backed builds unless proven safe by the chosen WASM stack; default assumption is **unsafe** without a single owner.

## Consequences

**Positive**

- Strong model for **replay** ([ADR0007](ADR0007-subsystem-revision-control-and-replay.md)).
- Aligns with **sync** via incremental or export-based replication.

**Negative**

- WASM payload size and load time; must lazy-load.
- Browser storage quotas; must surface clear errors.
- **SharedWorker** lifecycle and first-load complexity; **MVP single-writer tab** reduces scope but constrains UX until the worker lands.

## Rationale

User explicitly requested **WAL SQLite** with **client authoritative** semantics; SQLite delivers structured history in one embedded format shared conceptually with the server replica.

## Implementation

**Scope note:** The **store module**, migrations, and Vitest coverage are **landed**; **browser** WASM / OPFS / `SharedWorker` wiring and optional glue-snapshot tables remain **forward work** (see **Not in this slice** below).

**Location (package [`adventure-nl`](../../adventure-nl/)):**

| Area                                                                                 | Path                                                                                                                         |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Migrations (`user_version`), exported SQL for WASM bootstrap                         | [`adventure-nl/src/browser/subsystemWalStoreMigrations.ts`](../../adventure-nl/src/browser/subsystemWalStoreMigrations.ts) |
| Store API (`SubsystemWalStore`, `openSubsystemWalStore`, `migrateSubsystemWalStore`) | [`adventure-nl/src/browser/subsystemWalStore.ts`](../../adventure-nl/src/browser/subsystemWalStore.ts)                     |
| Cross-tab **BroadcastChannel** name and message shapes (MVP)                         | [`adventure-nl/src/browser/subsystemWalChannel.ts`](../../adventure-nl/src/browser/subsystemWalChannel.ts)                 |
| Automated tests (WAL, revisions, head concurrency, durability; tags / replay / revert per [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)) | [`adventure-nl/src/browser/subsystemWalStore.test.ts`](../../adventure-nl/src/browser/subsystemWalStore.test.ts)           |
| Server replica apply + `POST /api/subsystem-sync` ([ADR0008](ADR0008-server-subsystem-replica-and-sync.md)) | [`adventure-nl/src/cli/subsystemServerSync.ts`](../../adventure-nl/src/cli/subsystemServerSync.ts), [`webDashboard.ts`](../../adventure-nl/src/cli/webDashboard.ts) |

**Schema:** Migration **v1** — `store_metadata`, `revisions` (linear parent chain), `revision_file_changes` (per-revision path deltas; `NULL` content = delete), `promotion_records` (test/promotion events with JSON detail). Migration **v2** adds **`revision_tags`** (named pointers to revisions; see [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) **Implementation**).

**Not in this slice:** lazy-loaded WASM bundle in the dashboard, OPFS path selection, `SharedWorker` as sole DB owner, and optional glue-snapshot tables ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md))—those remain forward work on top of this module.

## Status

Accepted

## References

- `adventure-nl/src/cli/benchmarkRunsDb.ts` (server SQLite + WAL patterns)
- [`adventure-nl/src/browser/subsystemWalStore.ts`](../../adventure-nl/src/browser/subsystemWalStore.ts) (client subsystem store implementation)
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) (browser glue checkpointing uses this store)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)
- [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) — server replica + HTTP sync (**Implementation** in ADR0008)
- [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) (cross-tab coordination)
