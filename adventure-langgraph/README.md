# adventure-langgraph — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation map

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../docs/client/index.md) | Play and evaluate surfaces |
| Features | [`docs/features/`](../docs/features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../docs/developer/index.md) | Maintainer setup and mdcp workflow |
| Glossary | [`docs/glossary/`](../docs/_build/client-v3.md#glossary) | Shared terms |
| Architecture | [`docs/architecture/`](../docs/architecture/overview.md) | Legacy flat design views |
| ADRs | [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md) | Decision history |

**Client package READMEs** (this file may be one): compiled from `docs/client/readme-adventure-*/` into `adventure-langgraph/`, `adventure-webclient/`, and `adventure-nl/`.

**Developer package READMEs**: compiled from `docs/developer/readme-adventure-*/` into `adventure-v2/`, `adventure-ag2/`, and nested packages.

Edit shards under those directories, then run `npm run docs:compile` from `docs/`.

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

Thin **game-first** web client for Colossal Cave: hero CRT transcript (80×24), talking to the **adventure-v2** HTTP + SSE API.

**Default beside-CRT surface:** an **exploration map** column — a **draft** Mermaid directed graph of inferred places and compass moves from the visible transcript. A background **location agent** path (`POST /assist/ingest`) merges transcript lines; when assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core`.

**Legacy Assist** (posture, session signals, probe, JSON/Mermaid inspectors) stays in the tree but is **off by default** via feature flags.

## Quick start

From `adventure-langgraph/`:

```bash
npm install
npm start
```

That runs adventure-v2 `dev:server`, this package’s Vite app, and the assist HTTP server together. Open `<http://127.0.0.1:5174>` — shell → API at `<http://127.0.0.1:8787>`, draft map → assist at `<http://127.0.0.1:8790>` by default.

**Shell only** (API + assist already running elsewhere): `npm run dev`.

**Assist server only:** `npm run assist:dev`.

Optional — real Fortran output: from the repository root, `make adventure` so `./adventure` exists (see [Fortran oracle](../docs/_build/developer.md#fortran-oracle)).

Override API origin if needed:

```bash
VITE_API_URL=http://127.0.0.1:8787 npm start
```

| Service | Default | Override |
| --- | --- | --- |
| CRT (Vite) | 5174 | Vite config |
| Game API | 8787 | `VITE_API_URL` |
| Assist | 8790 | `VITE_ASSIST_URL`, `ASSIST_SERVER_PORT` |

Optional Ollama:

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.2
npm start
```

Without `OLLAMA_URL`, navigator uses the heuristic adapter only.

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

## Lint and tests

- **ESLint:** `npm run lint` — fix with `npm run lint:fix`
- **Prettier:** `npm run format:check` — apply with `npm run format`
- **Unit / component:** `npm test` (Vitest). **`test.projects`**: **`web`** = jsdom for `apps/web/**`; **`node`** for `packages/**`
- **Wire Gherkin (synthetic oracle):** `npm run test:cucumber`
- **Fortran wire scenarios:** requires repo-root `./adventure`; `npm run test:cucumber:fortran`

Suggested regression before merge:

```bash
npm run verify
```

Add `npm run test:cucumber:fortran` when you change oracle/subprocess wiring. For edits inside adventure-v2, also follow that package’s gates.

## Related docs

- End-user guide: [`docs/client/`](../docs/client/index.md)
- Maintainer setup: [`docs/developer/v3-dev-setup.md`](../docs/_build/developer.md#v3-dev-setup)
- Testing: [`docs/developer/v3-testing.md`](../docs/_build/developer.md#v3-testing)
- Features: [`docs/features/`](../docs/features/index.md)
