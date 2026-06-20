# Legacy docs

Architecture and decision records that predate the mdcp shard pipeline remain authoritative for deep design history.

## Architecture

Entry point: [docs/architecture/overview.md](../architecture/overview.md)

Notable views:

- [adventure-fortran-engine.md](../architecture/adventure-fortran-engine.md) — Fortran oracle and `adventure.dat`
- [adventure-v2/](../architecture/adventure-v2/overview.md) — HTTP API, oracle IPC, cognition layout
- [adventure-nl-cognition-and-workspace.md](../architecture/adventure-nl-cognition-and-workspace.md) — NL dashboard stack

## Architecture decision records

Index: [docs/decisions/adventure-nl-cognition-adr-index.md](../decisions/adventure-nl-cognition-adr-index.md)

ADRs use the `ADR####-kebab-case.md` naming convention under `docs/decisions/`.

## Migration note

New product documentation belongs in mdcp guides (`docs/features/`, `docs/client/`). Migrate legacy prose incrementally with `doc-only-task.prompt.md` — do not duplicate entire ADRs into shards.

## Other maintainer docs

- Root [README.md](../../README.md), [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [adventure-v3/README.md](../../adventure-v3/README.md) — package quick reference
- `.work-items/adventure-v3/` — planning hub (pre-shard)
