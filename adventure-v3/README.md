# adventure-v3 — CRT-first shell

Thin **game-first** web client for Colossal Cave: hero CRT transcript (v1 [`adventure-nl`](../adventure-nl/) metaphor), talking to the **adventure-v2** HTTP + SSE API. The CRT viewport is **80×24** characters (common terminal size; less line-wrapping than a 40-column window for Colossal Cave prose).

Optional **Assist** strip beside the CRT: use **Show assist panels** to choose **assistance posture** (**Quick assist** / **Study first**; choice persists in this browser tab via `sessionStorage` under `adventure-v3-assistance-posture`), see acknowledgment and stale-preview notice on change, and read plain-language rules (including how draft apply would work when that control exists). The strip shows **session signals** (derived from the visible transcript) and an **inspectable draft map**: Mermaid + JSON summaries built from compass echoes and `YOU ARE …` lines you already see on the CRT (not engine truth).

## Assist runtime — LangGraph draft map probe

The shell can call a small **assist HTTP server** (default **http://127.0.0.1:8790**) implemented in [`packages/assist-server`](packages/assist-server). It merges transcript text into a **directed graph** (`@adventure-v3/map-core`), then runs a **LangGraph** pipeline (cartographer → navigator). **Navigator** prefers a **local SLM** when configured; otherwise it uses a deterministic **heuristic** adapter so CI stays green.

From `adventure-v3/`:

- **Default `npm start`:** runs **API + Vite CRT + assist server** together (three processes). Open **http://127.0.0.1:5174**; assist listens on **http://127.0.0.1:8790** by default.
- **Assist server only** (e.g. debugging): `npm run assist:dev` — **`tsx watch`** restarts assist when **`packages/assist-server`** or imported **`packages/map-core`** sources change (**`ASSIST_SERVER_PORT`**, **`GET /assist/health`**).

**Browser → assist URL:** override with **`VITE_ASSIST_URL`** (defaults to **http://127.0.0.1:8790**).

**Optional Ollama (Llama / Gemma, etc.):** set **`OLLAMA_URL`** (e.g. `http://127.0.0.1:11434`) and optionally **`OLLAMA_MODEL`** (`llama3.2`, `gemma2`, …). If **`OLLAMA_URL`** is unset, the server uses the **heuristic** adapter only.

**Study first posture:** automated probe steps require the **Study first: confirm next probe step** checkbox before each assist-backed move (`studyFirstConfirmed` on **`POST /assist/step`**).

**Honest labeling (US‑3‑1 alignment):** the Draft map strip describes **model-assisted map probe**; the heuristic adapter is **not** an SLM — run Ollama when you intend real local LLM-backed navigation hints.

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
- **Git pre-commit:** When you stage files under `adventure-v3/`, the repo’s Husky hook runs **`lint-staged`** from this package ([`package.json`](package.json) `lint-staged` → ESLint `--fix` + Prettier on staged files). The hook is wired from [`adventure-nl/.husky/pre-commit`](../adventure-nl/.husky/pre-commit) (same pattern as `adventure-nl` and optional `adventure-v2` tests).

## Tests

- **Unit / component logic:** `npm test` (Vitest), including transcript/session signal derivation ([`apps/web/src/session/sessionSignals.test.ts`](apps/web/src/session/sessionSignals.test.ts)) and assistance posture copy ([`apps/web/src/posture/assistancePosture.test.ts`](apps/web/src/posture/assistancePosture.test.ts)).
- **Wire Gherkin (synthetic oracle):** `npm run test:cucumber` — temporary API + [`crt_wire_health.feature`](tests/features/crt_wire_health.feature) + [`crt_wire_first_turn.feature`](tests/features/crt_wire_first_turn.feature).
- **Fortran wire scenarios:** requires repo-root `./adventure` built with `make adventure`. Run `npm run test:cucumber:fortran` (loads [`tests/features/fortran/`](tests/features/fortran/) with auto Fortran oracle detection).

Suggested regression before merge from `adventure-v3/`: `npm run verify` (lint, Prettier check, unit tests, cucumber wire tests, production build). Add `npm run test:cucumber:fortran` when you change oracle/subprocess wiring. For edits inside [`adventure-v2`](../adventure-v2/), also follow that package’s gates.

Map / assist logic also has Vitest coverage under [`packages/map-core`](packages/map-core) and [`packages/assist-server`](packages/assist-server).
