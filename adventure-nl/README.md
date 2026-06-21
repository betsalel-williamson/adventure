# adventure-nl — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation links

| Tier          | Path                                                     | Audience                   |
| ------------- | -------------------------------------------------------- | -------------------------- |
| Client guides | [`docs/client/`](../docs/client/index.md)                | Play and evaluate surfaces |
| Features      | [`docs/features/`](../docs/features/index.md)            | Product capabilities       |
| Developer     | [`docs/developer/`](../docs/developer/index.md)          | Maintainer setup           |
| Glossary      | [`docs/glossary/`](../docs/_build/client-v3.md#glossary) | Shared terms               |

Start here: [`docs/index.md`](../docs/index.md)

## Key terms

| Term                 | Meaning                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| **Oracle**           | The Fortran game engine — authoritative source of room text and game state |
| **CRT**              | The hero transcript panel styled like an 80×24 terminal                    |
| **Draft assistance** | AI-inferred map or hints from visible text — not privileged game truth     |
| **Exploration map**  | Mermaid graph beside the CRT showing inferred places and moves             |
| **Assist server**    | HTTP service that merges transcript lines into the draft map               |

Full definitions: [`docs/glossary/`](../docs/_build/client-v3.md#glossary)

## Overview

TypeScript tooling for Colossal Cave Adventure: parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and adds optional **natural language** (NL) mapping — turning what you type at `>` into GETIN-safe tokens — with optional Gemini and other **text-model** backends.

**NL** means **natural language**, not a vendor name. Shared interpret/planner glue ships as **`@adventure-nl/nl-glue`** (`packages/nl-glue/`).

![Autoplay web dashboard](../../docs/adventure-nl-dashboard.png)

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

See [`.env.example`](../../adventure-nl/.env.example) for provider configuration.

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

Full list: [`.env.example`](../../adventure-nl/.env.example).

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

See [Honest labeling](../docs/client/readme-shards/honest-labeling.md).

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
