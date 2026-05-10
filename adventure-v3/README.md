# adventure-v3 — CRT-first shell

Thin **game-first** web client for Colossal Cave: hero CRT transcript (v1 [`adventure-nl`](../adventure-nl/) metaphor), talking to the **adventure-v2** HTTP + SSE API. The CRT viewport is **80×24** characters (common terminal size; less line-wrapping than a 40-column window for Colossal Cave prose).

## Quick start (API + CRT shell)

From this directory:

```bash
npm install
npm start
```

That runs [`adventure-v2`](../adventure-v2/) `dev:server` and this package’s Vite app together. Open **http://127.0.0.1:5174** (shell → API at **http://127.0.0.1:8787** by default).

**Shell only** (API already running elsewhere): `npm run dev`.

Optional — real Fortran output: from the repository root, `make adventure` so `./adventure` exists; the API then uses the **persistent** Fortran oracle automatically (see [adventure-v2 README](../adventure-v2/README.md)). With auto-Fortran, `GET /health` reports `processOracleScript: "adventure"` (basename), not `oracle-fortran-bridge.mjs`.

Override API origin if needed:

```bash
VITE_API_URL=http://127.0.0.1:8787 npm start
```

## Tests

- **Unit / component logic:** `npm test` (Vitest).
- **Wire Gherkin (synthetic oracle):** `npm run test:cucumber` — temporary API + [`crt_wire_health.feature`](tests/features/crt_wire_health.feature) + [`crt_wire_first_turn.feature`](tests/features/crt_wire_first_turn.feature).
- **Fortran wire scenarios:** requires repo-root `./adventure` built with `make adventure`. Run `npm run test:cucumber:fortran` (loads [`tests/features/fortran/`](tests/features/fortran/) with auto Fortran oracle detection).

Suggested regression before merge from `adventure-v3/`: `npm test && npm run test:cucumber` (add `npm run test:cucumber:fortran` when you change oracle/subprocess wiring). For edits inside [`adventure-v2`](../adventure-v2/), also follow that package’s gates.
