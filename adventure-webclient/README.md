# adventure-webclient — unified frontend shell

Standalone **Vite + TypeScript** client for developing Colossal Cave UI **separate from backend choice**. Preserves and migrates panels from:

- [`adventure-langgraph/`](../adventure-langgraph/) — CRT shell, Mermaid exploration map, assist panels
- [`adventure-nl/`](../adventure-nl/) — autoplay dashboard, prompt lab, 3D grid map, cognition chrome

## Why this package exists

Backends evolve independently (v2 HTTP, LangGraph assist, AG2 handoff, NL glue). The webclient holds **UI features behind flags** so you can:

1. Document each panel in [`docs/features/webclient/`](../docs/features/webclient/index.md)
2. Migrate implementation one feature at a time
3. Point the same shell at different backends via env vars

## Quick start

```bash
cd adventure-webclient
npm install
npm run dev
```

Open **http://127.0.0.1:5175** (default Vite port).

## Backend adapters (env)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VITE_WEBCLIENT_GAME_BACKEND` | `v2-http` | `v2-http` · `nl-dashboard` · `mock` |
| `VITE_WEBCLIENT_ASSIST_BACKEND` | `langgraph` | `langgraph` · `ag2` · `local-map-core` · `mock` |
| `VITE_WEBCLIENT_AGENT_BACKEND` | `none` | `nl-glue-browser` · `nl-glue-server` · `none` |
| `VITE_API_URL` | `http://127.0.0.1:8787` | Game API base |
| `VITE_ASSIST_URL` | `http://127.0.0.1:8790` | Assist server base |
| `VITE_NL_DASHBOARD_URL` | `https://127.0.0.1:8787` | NL dashboard when `game=nl-dashboard` |

Example — explore LangGraph assist UI against running servers:

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

Registry: [`apps/web/webclient-feature-flags.json`](apps/web/webclient-feature-flags.json)

Override order: **query string** → **sessionStorage** (`adventure-webclient-flag-<name>`) → **Vite env** → JSON defaults.

Full catalog: [`docs/features/webclient/`](../docs/features/webclient/index.md) (product) · [`docs/client/webclient/`](../docs/client/webclient/index.md) (personas) · [`docs/developer/webclient-migration-catalog.md`](../docs/developer/webclient-migration-catalog.md) (migration)

## Tests

```bash
npm test
```

## Migration status

| Source package | Status |
| -------------- | ------ |
| adventure-langgraph CRT + map | Documented; migration pending |
| adventure-nl dashboard panels | Documented; migration pending |
| Backend wiring in this shell | Config + types only (stub) |

Track work in [`.work-items/adventure-webclient/`](../.work-items/adventure-webclient/index.md).
