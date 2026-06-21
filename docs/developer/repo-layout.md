# Repository layout

The repository combines a Fortran game engine with optional TypeScript tooling across several packages.

## Top-level map

| Path | Purpose |
| --- | --- |
| `adventure.f`, `adventure.dat` | Fortran Colossal Cave source and data |
| `make adventure` | Build `./adventure` oracle binary |
| `adventure-nl/` | Natural-language CLI, autoplay dashboard, MCP glue |
| `adventure-v2/` | HTTP + SSE game API, cognition stubs, wire tests |
| `adventure-langgraph/` | CRT-first web shell + LangGraph assist server |
| `adventure-ag2/` | AG2 multi-agent handoff stub (Python bridge planned) |
| `adventure-webclient/` | Unified frontend shell — migrate NL + langgraph UI behind flags |
| `docs/` | Architecture ADRs, mdcp sharded guides |
| `.work-items/` | Feature planning (migrating into mdcp shards) |
| `guidelines/` | Lessons learned |

## adventure-langgraph packages

| Package | Role |
| --- | --- |
| `apps/web` | CRT shell, exploration map column, feature flags |
| `packages/map-core` | Directed graph merge, Mermaid serialization |
| `packages/assist-server` | Assist HTTP server, LangGraph cartographer/navigator |
| `packages/cartographer-fixtures` | Eval fixtures for ingest benchmarks |

adventure-langgraph depends on adventure-v2 at dev time (`npm start` runs v2 `dev:server`).

## adventure-ag2 packages

| Package | Role |
| --- | --- |
| `packages/ag2-bridge` | AG2 handoff contract, heuristic adapter, multi-agent turn orchestration |

adventure-ag2 reuses `@adventure-langgraph/map-core` for draft map logic. Real [AG2](https://github.com/ag2ai/ag2) integration will route `Ag2LlmAdapter` through a Python subprocess bridge.

## adventure-webclient

| Path | Role |
| ---- | ---- |
| `apps/web/` | Vite shell — panel placeholders + unified feature flags |
| `apps/web/src/backends/` | Game / assist / agent adapter config (env-driven) |

## Feature documentation (mdcp shards)

| Guide | Path |
| ----- | ---- |
| Client personas | [`docs/client/webclient/`](../client/webclient/index.md) |
| Product capabilities | [`docs/features/webclient/`](../features/webclient/index.md) |
| Migration + flags | [`webclient-migration-catalog.md`](webclient-migration-catalog.md), [`webclient-feature-flags.md`](webclient-feature-flags.md) |

## Documentation tiers

| Directory | Audience |
| --- | --- |
| `docs/features/` | What the product does |
| `docs/developer/` | How to work on the repo (this guide) |
| `docs/client/` | End-user and researcher play guides |
| `docs/glossary/` | Shared term definitions |
| `docs/architecture/`, `docs/decisions/` | Legacy flat docs (outside mdcp compile) |
