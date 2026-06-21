# adventure-langgraph — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation map

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../docs/client/index.md) | Play and evaluate the CRT shell |
| Features | [`docs/features/`](../docs/features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../docs/developer/index.md) | Maintainer setup and mdcp workflow |
| Glossary | [`docs/glossary/`](../docs/_build/glossary.md#glossary) | Shared terms |
| Architecture | [`docs/architecture/`](../docs/architecture/overview.md) | Legacy flat design views |
| ADRs | [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md) | Decision history |

Package `README.md` files in this repo are **compiled from mdcp readme guides** under `docs/readme-*`. Edit shards, then run `npm run docs:compile` from `docs/`.

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

Optional — real Fortran output: from the repository root, `make adventure` so `./adventure` exists (see [Fortran oracle](../docs/readme-shards/fortran-oracle.md)).

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

Defaults live in [`apps/web/langgraph-feature-flags.json`](apps/web/langgraph-feature-flags.json). Resolution runs in [`apps/web/src/featureFlags.ts`](apps/web/src/featureFlags.ts): **Vite env** overrides config defaults; **query string** or **`sessionStorage`** (`adventure-langgraph-flag-<name>`) overrides for local regression.

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

[`packages/assist-server`](packages/assist-server) merges transcript text into a **directed graph** (`@adventure-langgraph/map-core`).

- **`POST /assist/ingest`** — updates the graph from transcript (+ optional patch)
- **`POST /assist/step`** — with `advance: true` runs the LangGraph navigator only when probe is enabled server- and client-side

**Browser → assist URL:** override with **`VITE_ASSIST_URL`** (defaults to `<http://127.0.0.1:8790>`).

**Study first posture** (legacy Assist, when enabled): automated probe steps require the **Study first: confirm next probe step** checkbox before each assist-backed move.

See [Honest labeling](../docs/readme-shards/honest-labeling.md) — heuristic runs are not SLM-backed navigation.

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

## Glossary

Shared definitions for adventure documentation. Use these terms consistently across feature, developer, client, and compiled package README guides (`docs/readme-adventure-*/`).

Browse by group: [Product terms (v3)](#product-terms--adventure-langgraph).

### Terms

- [Product terms index](#product-terms--adventure-langgraph)
- [Oracle](#oracle)
- [SLM vs LLM](#slm-vs-llm)
- [Draft assistance](#draft-assistance)
- [CRT transcript](#crt-transcript)
- [Exploration map](#exploration-map)
- [Webclient](#webclient)
- [Cartographer](#cartographer)
- [Navigator](#navigator)
- [Heuristic adapter](#heuristic-adapter)
- [Assist server](#assist-server)

## Product terms — adventure-langgraph

Terms for the CRT shell, assist server, and draft exploration map.

### Terms

- [Oracle](#oracle)
- [SLM vs LLM](#slm-vs-llm)
- [Draft assistance](#draft-assistance)
- [CRT transcript](#crt-transcript)
- [Exploration map](#exploration-map)
- [Cartographer](#cartographer)
- [Navigator](#navigator)
- [Heuristic adapter](#heuristic-adapter)
- [Assist server](#assist-server)
- [Webclient](#webclient)

## Oracle

The **oracle** is the authoritative game process that answers parser commands with real Colossal Cave output.

In adventure-langgraph, the default oracle is the Fortran binary `./adventure` (built from the repository root with `make adventure`), orchestrated by adventure-v2 over HTTP and SSE. A **synthetic oracle** returns deterministic stub text for automated tests only.

Room descriptions, inventory changes, and puzzle outcomes from the oracle are **canonical game text**. Draft map and assist outputs never override the oracle.

## SLM vs LLM

This repository uses precise labels when describing model-backed behavior:

- **LLM (large language model)** — general term for cloud or hosted text models (for example Gemini) used in the adventure-nl natural-language stack.
- **SLM (small language model)** — a **local** or lightweight model invoked on the assist path (for example via Ollama) for navigator compass hints.

**Important:** The **heuristic adapter** is **not** an SLM. It is a rule-based fallback when `OLLAMA_URL` is unset. UI copy and research notes must label heuristic behavior honestly.

The adventure-nl stack maps **natural language** player text to parser tokens. That path is separate from v3’s SLM-backed **navigator** hints on `POST /assist/ingest` and `POST /assist/step`.

## Draft assistance

**Draft assistance** is any output from the exploration map, assist server, or navigator that **infers** structure from the visible transcript but is **not** canonical game text.

Examples:

- Mermaid directed graphs beside the CRT
- **Suggested next move** compass hints from the assist server
- Session signals and probe labels when legacy Assist panels are enabled

Draft assistance must be visually and verbally distinct from oracle room descriptions. When assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core` — still draft, not oracle truth.

## CRT transcript

The **CRT transcript** (hero CRT) is the main **80×24** character viewport where players type commands and read Adventure output.

It is the default game-first surface in adventure-langgraph: command input, room text, and parser responses appear here. Optional beside-CRT panels (exploration map, legacy Assist) support play but do not replace the transcript as the primary experience.

The CRT metaphor aligns with the adventure-nl dashboard aesthetic; v3 keeps the transcript thin and wired to adventure-v2 HTTP + SSE.

## Exploration map

The **exploration map** is the beside-CRT column that renders a **draft** Mermaid directed graph of inferred places and compass moves.

The graph is built from visible transcript cues:

- **YOU ARE** lines become place evidence
- Compass **echo** lines paired with the next **YOU ARE** commit edges (N, E, S, W, U, D)

The map updates in the background via the location agent path (`POST /assist/ingest`). It is **draft assistance** — Fortran remains truth for actual room state.

## Webclient

The **webclient** is the unified browser shell in `adventure-webclient/` — a single frontend for playing Colossal Cave and evaluating agent backends (LangGraph assist, AG2 handoff, NL autoplay) behind feature flags.

Until migration completes, production surfaces remain in `adventure-langgraph/apps/web` (CRT + default map) and `adventure-nl/public/` (autoplay dashboard). The webclient preserves those investments while decoupling UI from backend choice.

See [Client guide — webclient](../docs/_build/client-v3.md#client-guide--webclient) for personas and [Features — webclient](../docs/_build/features-v3.md#webclient--product-overview) for product capabilities.

## Cartographer

The **cartographer** is the LangGraph node (and conceptual role) that merges transcript text into a **directed map graph**.

On the default path, cartographer behavior uses deterministic merge from `@adventure-langgraph/map-core` (`mergeGraphFromTranscript`). When probe mode is enabled server- and client-side, cartographer participates in the LangGraph pipeline before the navigator step.

Cartographer output is always **draft assistance** — it does not send commands to the Fortran oracle.

## Navigator

The **navigator** is the LangGraph node that requests a **suggested next compass move** from an SLM adapter (Ollama) or falls back to the heuristic adapter.

Navigator hints appear as **draft assistance** — they are not auto-submitted to the game unless the player types a command or an explicit probe step (when map probe is enabled) sends one.

Configure real local models with `OLLAMA_URL` and optionally `OLLAMA_MODEL`. Without Ollama, the server uses the heuristic adapter only.

## Heuristic adapter

The **heuristic adapter** is the default **non-model** fallback for navigator move hints when `OLLAMA_URL` is unset.

It applies rule-based logic — **not** neural inference. Research write-ups and UI copy must **not** describe heuristic output as SLM or LLM reasoning.

Use Ollama (or another wired SLM adapter) when evaluating real local model behavior on the assist path.

## Assist server

The **assist server** is the local HTTP service (`packages/assist-server`, default port **8790**) that maintains per-run draft graph state from CRT transcript input.

Primary endpoints:

- **`POST /assist/ingest`** — merge transcript lines (+ optional graph patch) → `mapJson`, Mermaid, `suggestedNextMove`
- **`POST /assist/step`** — merge transcript; with `advance: true` and probe enabled, runs cartographer → navigator via LangGraph

The assist server does **not** own game authority. It consumes transcript text the client already received from the oracle wire and returns **draft assistance** only.

Browser origin override: `VITE_ASSIST_URL`. Probe requires `ASSIST_PROBE_ENABLED=true` on the server and client `mapProbe` flag.
