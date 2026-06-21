# adventure-langgraph — package README

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

Play Colossal Cave in your browser with a classic **CRT transcript** and a **draft exploration map** beside it.

### How it works

Thin **game-first** web client: hero CRT panel (80×24), talking to the **adventure-v2** HTTP + SSE API.

**Default beside-CRT surface:** an **exploration map** column — a **draft** Mermaid graph of inferred places and compass moves from the visible transcript. A background assist path merges transcript lines; when assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core`.

**Legacy Assist** panels (posture, session signals, probe, JSON/Mermaid inspectors) stay in the tree but are **off by default** via feature flags.

Play guide: [`docs/client/quick-start.md`](../docs/_build/client-v3.md#quick-start)

## Quick start

```bash
cd adventure-langgraph
npm install
npm start
```

Open `<http://127.0.0.1:5174>`. Play guide: [`docs/client/quick-start.md`](../docs/_build/client-v3.md#quick-start). Maintainer setup: [`docs/developer/v3-dev-setup.md`](../docs/_build/developer.md#v3-dev-setup).

**Shell only** (API + assist already running): `npm run dev`. **Assist only:** `npm run assist:dev`.

| Service | Default |
| --- | --- |
| CRT (Vite) | 5174 |
| Game API | 8787 |
| Assist | 8790 |

Optional Ollama: set `OLLAMA_URL` and `OLLAMA_MODEL` before `npm start`. Without Ollama, navigator uses the heuristic adapter only.

## Feature flags

Defaults live in [`apps/web/langgraph-feature-flags.json`](../../adventure-langgraph/apps/web/langgraph-feature-flags.json). Resolution runs in [`apps/web/src/featureFlags.ts`](../../adventure-langgraph/apps/web/src/featureFlags.ts): **Vite env** overrides config defaults; **query string** or **`sessionStorage`** (`adventure-langgraph-flag-<name>`) overrides for local regression.

| Flag | Env | Default |
| --- | --- | --- |
| `explorationMap` | `VITE_LANGGRAPH_EXPLORATION_MAP` | on |
| `assistPanels` | `VITE_LANGGRAPH_ASSIST_PANELS` | off |
| `mapProbe` | `VITE_LANGGRAPH_MAP_PROBE` | off |
| `mapInspectors` | `VITE_LANGGRAPH_MAP_INSPECTORS` | off |
| `locationAgent` | `VITE_LANGGRAPH_LOCATION_AGENT` | on |

Example — re-enable legacy Assist chrome:

```bash
VITE_LANGGRAPH_ASSIST_PANELS=true VITE_LANGGRAPH_MAP_PROBE=true VITE_LANGGRAPH_MAP_INSPECTORS=true npm run dev
```

Assist server: set **`ASSIST_PROBE_ENABLED=true`** to allow `advance: true` on **`POST /assist/step`** (still requires client `mapProbe`).

## Assist runtime

[`packages/assist-server`](../../adventure-langgraph/packages/assist-server) merges transcript text into a **directed graph** (`@adventure-langgraph/map-core`).

- **`POST /assist/ingest`** — updates the graph from transcript (+ optional patch)
- **`POST /assist/step`** — with `advance: true` runs the LangGraph navigator only when probe is enabled server- and client-side

**Browser → assist URL:** override with **`VITE_ASSIST_URL`** (defaults to `<http://127.0.0.1:8790>`).

**Study first posture** (legacy Assist, when enabled): automated probe steps require the **Study first: confirm next probe step** checkbox before each assist-backed move.

See [Honest labeling](../docs/client/readme-shards/honest-labeling.md) — heuristic runs are not SLM-backed navigation.

Full product detail: [Assist runtime](../docs/_build/features-v3.md#assist-runtime).

## Related docs

- End-user guide: [`docs/client/`](../docs/client/index.md)
- Maintainer setup: [`docs/developer/v3-dev-setup.md`](../docs/_build/developer.md#v3-dev-setup)
- Testing: [`docs/developer/v3-testing.md`](../docs/_build/developer.md#v3-testing)
- Features: [`docs/features/`](../docs/features/index.md)
