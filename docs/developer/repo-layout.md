# Repository layout

The repository combines a Fortran game engine with optional TypeScript tooling across several packages.

## Top-level map

| Path | Purpose |
| --- | --- |
| `adventure.f`, `adventure.dat` | Fortran Colossal Cave source and data |
| `make adventure` | Build `./adventure` oracle binary |
| `adventure-nl/` | Natural-language CLI, autoplay dashboard, MCP glue |
| `adventure-v2/` | HTTP + SSE game API, cognition stubs, wire tests |
| `adventure-v3/` | CRT-first web shell + assist server (primary v3 surface) |
| `docs/` | Architecture ADRs, mdcp sharded guides |
| `.work-items/` | Feature planning (migrating into mdcp shards) |
| `guidelines/` | Lessons learned |

## adventure-v3 packages

| Package | Role |
| --- | --- |
| `apps/web` | CRT shell, exploration map column, feature flags |
| `packages/map-core` | Directed graph merge, Mermaid serialization |
| `packages/assist-server` | Assist HTTP server, LangGraph cartographer/navigator |
| `packages/cartographer-fixtures` | Eval fixtures for ingest benchmarks |

adventure-v3 depends on adventure-v2 at dev time (`npm start` runs v2 `dev:server`).

## Documentation tiers

| Directory | Audience |
| --- | --- |
| `docs/features/` | What the product does |
| `docs/developer/` | How to work on the repo (this guide) |
| `docs/client/` | End-user and researcher play guides |
| `docs/glossary/` | Shared term definitions |
| `docs/architecture/`, `docs/decisions/` | Legacy flat docs (outside mdcp compile) |
