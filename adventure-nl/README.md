# adventure-nl — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation map

| Tier          | Path                                                                       | Audience                           |
| ------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| Client guides | [`docs/client/`](../docs/client/index.md)                                  | Play and evaluate the CRT shell    |
| Features      | [`docs/features/`](../docs/features/index.md)                              | Product capabilities               |
| Developer     | [`docs/developer/`](../docs/developer/index.md)                            | Maintainer setup and mdcp workflow |
| Glossary      | [`docs/glossary/`](../docs/_build/glossary.md#glossary)                    | Shared terms                       |
| Architecture  | [`docs/architecture/`](../docs/architecture/overview.md)                   | Legacy flat design views           |
| ADRs          | [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md) | Decision history                   |

Package `README.md` files in this repo are **compiled from mdcp readme guides** under `docs/readme-*`. Edit shards, then run `npm run docs:compile` from `docs/`.

## Overview

TypeScript tooling for Colossal Cave Adventure: parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and adds optional **natural language** (NL) mapping — turning what you type at `>` into GETIN-safe tokens — with optional Gemini and other **text-model** backends.

**NL** means **natural language**, not a vendor name. Shared interpret/planner glue ships as **`@adventure-nl/nl-glue`** (`packages/nl-glue/`).

![Autoplay web dashboard](../docs/adventure-nl-dashboard.png)

## Commands

```sh
npm install
npm run check
npm run build
```

From repository root, `make clean` removes `adventure-nl/node_modules` for a full reinstall.

#### CLI

After `npm run build`:

```sh
npm start
```

Or: `node dist/cli/main.js`

With **`GEMINI_API_KEY`**, the first line can be natural language; after that, classic GETIN input until `.quit` / `:q`.

**`npm start -- --classic`** — Fortran-only TTY (no NL).

**`npm start -- --autoplay`** — self-acting mode with text model planning (requires configured provider; not compatible with `--classic`).

See [`.env.example`](.env.example) for provider configuration.

## Web dashboard

After `make` at repo root (so `../adventure` exists), from **`adventure-nl/`**:

1. One-time TLS: **`npm run web:tls-init`** — writes `.cache/tls/dev-key.pem` and `dev-cert.pem`
2. **`npm run build && npm run web`** — **HTTPS** on **`127.0.0.1:8787`** (override with **`ADVENTURE_NL_WEB_PORT`**)

From repo root: **`make run-autoplay-web`** or **`make run-autoplay-web-insecure`** for plain HTTP.

Open `<https://127.0.0.1:8787/>`. Demo: [`DEMO.md`](../DEMO.md). REST/SSE: [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md).

**Browser warnings** for the self-signed dev cert are normal on localhost — use Advanced → continue, or [mkcert](https://github.com/FiloSottile/mkcert).

**Sessions do not survive server restarts** — the `adventure_session` cookie maps to in-memory state only.

Dashboard modules and test pairings: [`docs/source-map.md`](docs/source-map.md).

## Environment variables

Full list: [`.env.example`](.env.example).

| Variable                                     | Purpose                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| `GEMINI_API_KEY`                             | Enables NL first line; omit or use `--classic` for Fortran-only |
| `GEMINI_TEXT_MODEL`                          | Optional; defaults to `gemini-2.5-flash`                        |
| `ADVENTURE_NL_DEBUG`                         | `1` — JSONL interaction logs under `.cache/`                    |
| `ADVENTURE_NL_WEB_PORT`                      | Dashboard listen port (default `8787`)                          |
| `ADVENTURE_NL_WEB_INSECURE_HTTP`             | `1` — plain HTTP, no Secure cookie                              |
| `ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY` | Default on for google/http providers; MLX uses Node glue        |
| `ADVENTURE_NL_MLX_MODEL`                     | MLX checkpoint (default `mlx-community/gemma-2-2b-it`)          |
| `ADVENTURE_NL_HTTP_*`                        | OpenAI-compatible HTTP provider settings                        |
| `ADVENTURE_NL_AUTOPLAY_PACE_MS`              | Delay between autoplay moves (default `2000`)                   |
| `ADVENTURE_NL_AUTOPLAY_MAX_MOVES`            | Stop after N GETIN lines (default `120`)                        |
| `HF_TOKEN`                                   | Hugging Face token for smoother MLX model downloads             |
| `NVD_API_KEY`                                | Optional; OWASP Dependency-Check NVD API                        |

Logs and cache default to `adventure-nl/.cache/` (gitignored).

## Providers

- **Google Gemini** — JSON schema / enum constraints when supported
- **OpenAI-compatible HTTP** — set `ADVENTURE_NL_HTTP_*`; optional `ADVENTURE_NL_HTTP_JSON_SCHEMA=1`
- **MLX (local)** — unconstrained text generation; compact/structured prompts default on for small models

The Fortran game remains truth; the dashboard repeats **heuristic** location/inventory from recent output.

**Text model dropdown** (when configured) hot-swaps MLX, HTTP, and Gemini without restart. Distinct presets share reference-counted server clients; global FIFO queue limits concurrent LLM calls.

See [Honest labeling](../docs/readme-shards/honest-labeling.md).

Architecture: [`docs/architecture/adventure-engine.md`](../docs/architecture/adventure-engine.md).

## Layout and tests

| Path                | Role                                      |
| ------------------- | ----------------------------------------- |
| `src/dat/`          | `adventure.dat` loader                    |
| `src/engine/`       | Fortran subprocess oracle                 |
| `src/cli/`          | GETIN tokenizer, web dashboard server     |
| `src/nl/`           | NL providers, interpret/autoplay pipeline |
| `packages/nl-glue/` | Shared interpret/planner/MCP glue         |
| `public/`           | Autoplay dashboard ES modules             |

```bash
npm test
npm run check   # lint + tsc + tests
```

Module ↔ test map: [`docs/source-map.md`](docs/source-map.md).

## OWASP Dependency-Check

Install: `brew install dependency-check`

From repository root:

```sh
make dependency-check
```

Or from `adventure-nl/` after `npm install`:

```sh
npm run dependency-check
```

Reports: `adventure-nl/reports/dependency-check/` (HTML + JSON).

First run downloads NVD data and can take several minutes. Set **`NVD_API_KEY`** to avoid HTTP 429 rate limits, or use **`make dependency-check-quick`** / `npm run dependency-check:quick`.

## Related docs

- API reference: [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md)
- Demo script: [`DEMO.md`](../DEMO.md)
- ADRs: [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md)
- nl-glue package: [`packages/nl-glue/README.md`](packages/nl-glue/README.md)

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
