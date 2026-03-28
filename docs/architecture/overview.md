# Architecture documentation — Adventure repository

## Purpose

This directory holds **project-level** architecture views for the Colossal Cave Adventure codebase: the Fortran engine and data file, and the optional `adventure-llm` TypeScript package that wraps the binary with natural language, autoplay, and related tooling.

## Documents

| Document | Scope |
|----------|--------|
| [adventure-engine.md](./adventure-engine.md) | **`adventure-llm`**: dat loading, subprocess driver, `TextLlm` providers, NL pipeline, cache, CLI interactive vs autoplay, imagery. |
| [adventure-fortran-engine.md](./adventure-fortran-engine.md) | **`adventure.f`** and **`adventure.dat`** only: loader, in-memory model, GETIN / ATAB, turn loop. |
| [ADR0001: adventure-llm TextLlm providers](../decisions/ADR0001-adventure-llm-text-llm-providers.md) | Decision record: unified post-parse pipeline, interpret cache keys, interactive session prefix, HTTP retries, debug truncation. |

## Source layout (high level)

- **Fortran simulation**: [`adventure.f`](../../adventure.f), [`adventure.dat`](../../adventure.dat), built [`adventure`](../../adventure) binary.
- **TypeScript package**: [`adventure-llm/`](../../adventure-llm/) — CLI, NL module (`src/nl/`), engine glue (`src/engine/`), DAT loader (`src/dat/`).
