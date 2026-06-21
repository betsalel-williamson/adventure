# v3 overview

adventure-langgraph is a **game-first** web shell for Colossal Cave Adventure. The hero surface is an **80×24 CRT transcript** where players type parser commands and read real game output.

## Authority model

| Layer | Role |
| --- | --- |
| **Fortran oracle** (`./adventure`) | Simulation of truth — room state, inventory, puzzles |
| **adventure-v2 API** | HTTP + SSE orchestration; persistent oracle per run |
| **adventure-langgraph client** | CRT transcript, optional exploration map, assist ingest |
| **Assist server** | Draft graph and hints from transcript — never canonical game text |

Map and assist features consume **user-visible** transcript streams and produce **draft assistance** only.

## Default runtimes

When you `npm start` from `adventure-langgraph/`:

| Service | Default URL |
| --- | --- |
| Web CRT shell | `http://127.0.0.1:5174` |
| Game API (v2) | `http://127.0.0.1:8787` |
| Assist server | `http://127.0.0.1:8790` |

Build Fortran for real cave text: `make adventure` from the repository root.

## Feature flags

Build defaults live in `apps/web/langgraph-feature-flags.json`. Vite env (`VITE_LANGGRAPH_*`) and query/session overrides apply for local regression. Legacy Assist panels (posture, probe, inspectors) stay **off by default**.

## Related documentation

- Legacy architecture: [docs/architecture/](../architecture/overview.md)
- Planning hub (pre-migration): `.work-items/adventure-langgraph/`
