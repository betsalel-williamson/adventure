# adventure-langgraph — CRT-first shell (LangGraph assist)

Thin **game-first** web client for Colossal Cave: hero CRT transcript (v1 [`adventure-nl`](../adventure-nl/) metaphor), talking to the **adventure-v2** HTTP + SSE API. The CRT viewport is **80×24** characters (common terminal size; less line-wrapping than a 40-column window for Colossal Cave prose).

**Documentation:** end-user / researcher guide — [`docs/client/`](../docs/client/index.md); maintainer setup — [`docs/developer/v3-dev-setup.md`](../docs/developer/v3-dev-setup.md).

**Default beside-CRT surface:** an **exploration map** column — a **draft** Mermaid directed graph of inferred places and compass moves from the visible transcript (Fortran remains truth). A background **location agent** path (`POST /assist/ingest`) merges transcript lines; when assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core`.

**Legacy Assist** (posture, session signals, probe, JSON/Mermaid inspectors) stays in the tree but is **off by default** via feature flags.

## Feature flags (build + dev overrides)

Defaults live in [`apps/web/langgraph-feature-flags.json`](apps/web/langgraph-feature-flags.json). Resolution runs in [`apps/web/src/featureFlags.ts`](apps/web/src/featureFlags.ts): **Vite env** overrides config defaults; **query string** or **`sessionStorage`** (`adventure-langgraph-flag-<name>`) overrides for local regression.

| Flag             | Env                       | Default |
| ---------------- | ------------------------- | ------- |
| `explorationMap` | `VITE_LANGGRAPH_EXPLORATION_MAP` | on      |
| `assistPanels`   | `VITE_LANGGRAPH_ASSIST_PANELS`   | off     |
| `mapProbe`       | `VITE_LANGGRAPH_MAP_PROBE`       | off     |
| `mapInspectors`  | `VITE_LANGGRAPH_MAP_INSPECTORS`  | off     |
| `locationAgent`  | `VITE_LANGGRAPH_LOCATION_AGENT`  | on      |

Example — re-enable slice-02–05 Assist chrome:

```bash
VITE_LANGGRAPH_ASSIST_PANELS=true VITE_LANGGRAPH_MAP_PROBE=true VITE_LANGGRAPH_MAP_INSPECTORS=true npm run dev
```

Assist server: set **`ASSIST_PROBE_ENABLED=true`** to allow `advance: true` on **`POST /assist/step`** (still requires client `mapProbe`).

## Assist runtime

[`packages/assist-server`](packages/assist-server) merges transcript text into a **directed graph** (`@adventure-langgraph/map-core`). **`POST /assist/ingest`** updates the graph from transcript (+ optional patch). **`POST /assist/step`** with `advance: true` runs the LangGraph navigator only when probe is enabled server- and client-side.

From `adventure-langgraph/`:

- **Default `npm start`:** runs **API + Vite CRT + assist server** together (three processes). Open **http://127.0.0.1:5174**; assist listens on **http://127.0.0.1:8790** by default.
- **Assist server only** (e.g. debugging): `npm run assist:dev` — **`tsx watch`** restarts assist when **`packages/assist-server`** or imported **`packages/map-core`** sources change (**`ASSIST_SERVER_PORT`**, **`GET /assist/health`**).

**Browser → assist URL:** override with **`VITE_ASSIST_URL`** (defaults to **http://127.0.0.1:8790**).

**Optional Ollama (Llama / Gemma, etc.):** set **`OLLAMA_URL`** (e.g. `http://127.0.0.1:11434`) and optionally **`OLLAMA_MODEL`** (`llama3.2`, `gemma2`, …). If **`OLLAMA_URL`** is unset, the server uses the **heuristic** adapter only.

**Study first posture** (legacy Assist, when enabled): automated probe steps require the **Study first: confirm next probe step** checkbox before each assist-backed move (`studyFirstConfirmed` on **`POST /assist/step`**).

**Honest labeling (US‑3‑1 alignment):** map copy describes **draft assistance**; the heuristic adapter is **not** an SLM — run Ollama when you intend real local LLM-backed navigation hints.

## Quick start (API + CRT shell)

From this directory:

```bash
npm install
npm start
```

That runs [`adventure-v2`](../adventure-v2/) `dev:server`, this package’s Vite app, and the **assist HTTP server** (`npm run assist:dev` in the same `concurrently` group). Open **http://127.0.0.1:5174** — shell → API at **http://127.0.0.1:8787**, draft map → assist at **http://127.0.0.1:8790** by default.

**Shell only** (API + assist already running elsewhere): `npm run dev`.

Optional — real Fortran output: from the repository root, `make adventure` so `./adventure` exists; the API then uses the **persistent** Fortran oracle automatically (see [adventure-v2 README](../adventure-v2/README.md)). With auto-Fortran, `GET /health` reports `processOracleScript: "adventure"` (basename), not `oracle-fortran-bridge.mjs`.

Override API origin if needed:

```bash
VITE_API_URL=http://127.0.0.1:8787 npm start
```

## Lint and format

- **ESLint** (flat config: [`eslint.config.js`](eslint.config.js)): `npm run lint` — fix safe issues with `npm run lint:fix`.
- **Prettier** ([`prettier.config.js`](prettier.config.js)): `npm run format:check` — apply with `npm run format`.
- **Git pre-commit:** When you stage files under `adventure-langgraph/`, the repo’s Husky hook runs **`lint-staged`** from this package ([`package.json`](package.json) `lint-staged` → ESLint `--fix` + Prettier on staged files). The hook is wired from [`adventure-nl/.husky/pre-commit`](../adventure-nl/.husky/pre-commit) (same pattern as `adventure-nl` and optional `adventure-v2` tests).

## Tests

- **Unit / component logic:** `npm test` (Vitest). **`test.projects`** in [`vitest.config.ts`](vitest.config.ts): **`web`** = jsdom for `apps/web/**`; **`node`** for `packages/**`. Put **colocated** specs next to the module under `apps/web/src/**/*.test.ts` when you need `vi.mock` of sibling imports; keep **harness-style** cases under [`apps/web/tests/`](apps/web/tests/) when the test loads full shell HTML or shared DOM helpers.
- **Frontend shell harness:** [`apps/web/tests/harness/`](apps/web/tests/harness/) loads real [`index.html`](apps/web/index.html) markup into jsdom (`loadShellIndexBodyIntoDocument`, `resetShellDomWithFlags`). Contract + integration tests live under [`apps/web/tests/`](apps/web/tests/). Run only web (jsdom) tests: `npm run test:web` (`vitest run --project web`).
- **Wire Gherkin (synthetic oracle):** `npm run test:cucumber` — temporary API + assist (for `@assist` features) + [`crt_wire_health.feature`](tests/features/crt_wire_health.feature) + [`crt_wire_first_turn.feature`](tests/features/crt_wire_first_turn.feature) + [`crt_assist_exploration_wire.feature`](tests/features/crt_assist_exploration_wire.feature) (HTTP contract for `POST /assist/ingest` used by the exploration map).
- **Fortran wire scenarios:** requires repo-root `./adventure` built with `make adventure`. Run `npm run test:cucumber:fortran` (loads [`tests/features/fortran/`](tests/features/fortran/) with auto Fortran oracle detection).

Suggested regression before merge from `adventure-langgraph/`: `npm run verify` (lint, Prettier check, unit tests, cucumber wire tests, production build). Add `npm run test:cucumber:fortran` when you change oracle/subprocess wiring. For edits inside [`adventure-v2`](../adventure-v2/), also follow that package’s gates.

Map / assist logic also has Vitest coverage under [`packages/map-core`](packages/map-core) and [`packages/assist-server`](packages/assist-server).
