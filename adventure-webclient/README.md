# adventure-webclient — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation links

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../docs/client/index.md) | Play and evaluate surfaces |
| Features | [`docs/features/`](../docs/features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../docs/developer/index.md) | Maintainer setup |
| Glossary | [`docs/glossary/`](../docs/_build/client-v3.md#glossary) | Shared terms |

Start here: [`docs/index.md`](../docs/index.md)

## Key terms

| Term | Meaning |
| --- | --- |
| **Oracle** | The Fortran game engine — authoritative source of room text and game state |
| **CRT** | The hero transcript panel styled like an 80×24 terminal |
| **Draft assistance** | AI-inferred map or hints from visible text — not privileged game truth |
| **Exploration map** | Mermaid graph beside the CRT showing inferred places and moves |
| **Assist server** | HTTP service that merges transcript lines into the draft map |

Full definitions: [`docs/glossary/`](../docs/_build/client-v3.md#glossary)

## Overview

Standalone **Vite + TypeScript** client for developing Colossal Cave UI **separate from backend choice**. Migrates panels from adventure-langgraph (CRT, Mermaid map, assist) and adventure-nl (autoplay dashboard, prompt lab, 3D grid) behind **feature flags** and env-driven backend adapters.

Backends evolve independently (v2 HTTP, LangGraph assist, AG2 handoff, NL glue). The webclient holds UI features behind flags so you can document, migrate, and point the same shell at different backends.

## Quick start

```bash
cd adventure-webclient
npm install
npm run dev
```

Open `<http://127.0.0.1:5175>` (default Vite port).

Production build check:

```bash
npm run build
npm test
```

Maintainer detail: [`docs/developer/webclient-dev-setup.md`](../docs/_build/developer.md#webclient-dev-setup).

## Backend adapters

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_WEBCLIENT_GAME_BACKEND` | `v2-http` | `v2-http` · `nl-dashboard` · `mock` |
| `VITE_WEBCLIENT_ASSIST_BACKEND` | `langgraph` | `langgraph` · `ag2` · `local-map-core` · `mock` |
| `VITE_WEBCLIENT_AGENT_BACKEND` | `none` | `nl-glue-browser` · `nl-glue-server` · `none` |
| `VITE_API_URL` | `http://127.0.0.1:8787` | Game API base |
| `VITE_ASSIST_URL` | `http://127.0.0.1:8790` | Assist server base |
| `VITE_NL_DASHBOARD_URL` | `https://127.0.0.1:8787` | NL dashboard when `game=nl-dashboard` |

Example — LangGraph assist against running servers:

```bash
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true \
VITE_WEBCLIENT_ASSIST_BACKEND=langgraph \
npm run dev
```

Example — AG2 assist backend (when wired):

```bash
VITE_WEBCLIENT_ASSIST_BACKEND=ag2 npm run dev
```

## Feature flags

Registry: [`apps/web/webclient-feature-flags.json`](../../adventure-webclient/apps/web/webclient-feature-flags.json)

Override order: **query string** → **sessionStorage** (`adventure-webclient-flag-<name>`) → **Vite env** → JSON defaults.

Full catalog:

- [`docs/features/webclient/`](../docs/_build/features-v3.md#webclient--product-overview) (product)
- [`docs/client/webclient/`](../docs/_build/client-v3.md#client-guide--webclient) (personas)
- [`docs/developer/webclient-migration-catalog.md`](../docs/_build/developer.md#webclient-migration-catalog) (migration)

## Migration status

| Source package | Status |
| --- | --- |
| adventure-langgraph CRT + map | Documented; migration pending |
| adventure-nl dashboard panels | Documented; migration pending |
| Backend wiring in this shell | Config + types only (stub) |

Track migration in [`docs/developer/webclient-migration-catalog.md`](../docs/_build/developer.md#webclient-migration-catalog).

Until CRT migration completes, use [adventure-langgraph](../adventure-langgraph/README.md) or [adventure-nl](../adventure-nl/README.md) for production play.

## Testing

```bash
npm test
```

See [Testing baseline](../docs/developer/readme-shards/testing-baseline.md).

## Related docs

- [Webclient dev setup](../docs/_build/developer.md#webclient-dev-setup)
- [Webclient feature flags](../docs/_build/developer.md#webclient-feature-flags)
- [Repository layout](../docs/_build/developer.md#repository-layout)
