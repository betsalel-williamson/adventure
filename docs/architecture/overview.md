# Architecture documentation — Adventure repository

## Purpose

This directory holds **project-level** architecture views for the Colossal Cave Adventure codebase: the Fortran engine and data file, and the optional `adventure-lm` TypeScript package that wraps the binary with natural language, autoplay, and related tooling.

## Current direction (adventure-lm)

**Target architecture** (client-side **glue** over streamed text, thin backend for Fortran + `adventure.dat` + model pool + LLM packaging, subsystem workspace with SQLite and ADR0004–ADR0012) is summarized in **[adventure-lm-cognition-and-workspace.md](./adventure-lm-cognition-and-workspace.md)**. **[ADR0006](./decisions/ADR0006-client-sqlite-wal-subsystem-store.md)** subsystem store (schema + API) and **[ADR0007](./decisions/ADR0007-subsystem-revision-control-and-replay.md)** tags / replay / revert APIs are **implemented** under `adventure-lm/src/browser/`; browser WASM/OPFS wiring and VC dashboard UX remain forward work per those ADRs. **[ADR0008](./decisions/ADR0008-server-subsystem-replica-and-sync.md)** server replica + **`POST /api/subsystem-sync`** are **implemented** under `adventure-lm/src/cli/` (see ADR0008 **Implementation**); client-orchestrated sync calls and restore UX remain forward work. **[adventure-engine.md](./adventure-engine.md)** below remains the **as-built** description of the package until each migration step lands; read both when changing `adventure-lm`.

## Documents

| Document                                                                                             | Scope                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [adventure-lm-cognition-and-workspace.md](./adventure-lm-cognition-and-workspace.md)               | **Direction of travel** for `adventure-lm`: browser **glue** (map, inventory, modes, heuristics), workspace, client SQLite + sync, packaging API; points to ADR0004–ADR0012.                                                            |
| [lm-glue-backend-interaction.md](./lm-glue-backend-interaction.md)                                   | **Glue package vs backend**: static dependency view, ideal single choke-point for request → glue → ML → glue → client, gaps vs today’s provider-embedded glue. |
| [adventure-engine.md](./adventure-engine.md)                                                         | **`adventure-lm` (as built today)**: dat loading, subprocess driver, `TextLlm` providers, NL pipeline, cache, CLI interactive vs autoplay, autoplay prompt modes (`explore` / `full`), session memory + guards, web dashboard, imagery. |
| [adventure-fortran-engine.md](./adventure-fortran-engine.md)                                         | **`adventure.f`** and **`adventure.dat`** only: loader, in-memory model, GETIN / ATAB, turn loop.                                                                                                                                        |
| [ADR0001: adventure-lm TextLlm providers](../decisions/ADR0001-adventure-lm-text-llm-providers.md) | Decision record: unified post-parse pipeline, interpret cache keys, interactive session prefix, HTTP retries, debug truncation.                                                                                                          |

## Source layout (high level)

- **Fortran simulation**: [`adventure.f`](../../adventure.f), [`adventure.dat`](../../adventure.dat), built [`adventure`](../../adventure) binary.
- **TypeScript package**: [`adventure-lm/`](../../adventure-lm/) — CLI, NL module (`src/nl/`), engine glue (`src/engine/`), DAT loader (`src/dat/`). Dashboard browser code lives under [`adventure-lm/public/`](../../adventure-lm/public/); Vitest suites that import those modules currently sit at the **`src/` root** (for example `sseJson.test.ts`, `dashboardEventStream.dom.test.ts`) — see [`adventure-lm/docs/source-map.md`](../../adventure-lm/docs/source-map.md).
