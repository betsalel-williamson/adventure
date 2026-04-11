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

## Decision

- Store subsystem **files**, **revisions**, **metadata**, and **test/promotion records** in a **client-side SQLite** database opened in the browser via a **WASM** stack (e.g. wa-sqlite + OPFS, or sql.js with persistence — **finalize in implementation** with integration tests).
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

## Status

Proposed

## References

- `adventure-llm/src/cli/benchmarkRunsDb.ts` (server SQLite patterns)
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) (browser glue checkpointing uses this store)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)
- [ADR0008](ADR0008-server-subsystem-replica-and-sync.md)
- [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) (cross-tab coordination)
