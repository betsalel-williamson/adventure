# Architecture documentation — Adventure repository

## Purpose

This directory holds **project-level** architecture views for the Colossal Cave Adventure codebase: the Fortran engine and data file, and the optional `adventure-llm` TypeScript package that wraps the binary with natural language, autoplay, and related tooling.

## Current direction (adventure-llm)

**Target architecture** (client-side **glue** over streamed text, thin backend for Fortran + `adventure.dat` + model pool + LLM packaging, subsystem workspace with SQLite and ADR0004–ADR0012) is summarized in **[adventure-llm-cognition-and-workspace.md](./adventure-llm-cognition-and-workspace.md)**. **[ADR0006](./decisions/ADR0006-client-sqlite-wal-subsystem-store.md)** subsystem store (schema + API) and **[ADR0007](./decisions/ADR0007-subsystem-revision-control-and-replay.md)** tags / replay / revert APIs are **implemented** under `adventure-llm/src/browser/`; browser WASM/OPFS wiring and VC dashboard UX remain forward work per those ADRs. **[ADR0008](./decisions/ADR0008-server-subsystem-replica-and-sync.md)** server replica + **`POST /api/subsystem-sync`** are **implemented** under `adventure-llm/src/cli/` (see ADR0008 **Implementation**); client-orchestrated sync calls and restore UX remain forward work. **[adventure-engine.md](./adventure-engine.md)** below remains the **as-built** description of the package until each migration step lands; read both when changing `adventure-llm`.

## Documents

| Document                                                                                             | Scope                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [adventure-llm-cognition-and-workspace.md](./adventure-llm-cognition-and-workspace.md)               | **Direction of travel** for `adventure-llm`: browser **glue** (map, inventory, modes, heuristics), workspace, client SQLite + sync, packaging API; points to ADR0004–ADR0012.                                                            |
| [adventure-engine.md](./adventure-engine.md)                                                         | **`adventure-llm` (as built today)**: dat loading, subprocess driver, `TextLlm` providers, NL pipeline, cache, CLI interactive vs autoplay, autoplay prompt modes (`explore` / `full`), session memory + guards, web dashboard, imagery. |
| [adventure-fortran-engine.md](./adventure-fortran-engine.md)                                         | **`adventure.f`** and **`adventure.dat`** only: loader, in-memory model, GETIN / ATAB, turn loop.                                                                                                                                        |
| [ADR0001: adventure-llm TextLlm providers](../decisions/ADR0001-adventure-llm-text-llm-providers.md) | Decision record: unified post-parse pipeline, interpret cache keys, interactive session prefix, HTTP retries, debug truncation.                                                                                                          |

## Source layout (high level)

- **Fortran simulation**: [`adventure.f`](../../adventure.f), [`adventure.dat`](../../adventure.dat), built [`adventure`](../../adventure) binary.
- **TypeScript package**: [`adventure-llm/`](../../adventure-llm/) — CLI, NL module (`src/nl/`), engine glue (`src/engine/`), DAT loader (`src/dat/`). Dashboard browser code lives under [`adventure-llm/public/`](../../adventure-llm/public/); Vitest suites that import those modules currently sit at the **`src/` root** (for example `sseJson.test.ts`, `dashboardEventStream.dom.test.ts`) — see [`adventure-llm/docs/source-map.md`](../../adventure-llm/docs/source-map.md).
