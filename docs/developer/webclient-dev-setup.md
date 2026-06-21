# Webclient dev setup

How to run and develop the unified **adventure-webclient** shell separately from backend packages.

## Prerequisites

- Node.js **24+** — version in repo [`.nvmrc`](../../.nvmrc)
- Optional backends depending on what you are testing — [Typical backend pairings](#typical-backend-pairings)

## Install and run

```bash
cd adventure-webclient
npm install
npm run dev
```

Default URL: `http://127.0.0.1:5175`

Production build check:

```bash
npm run build
npm test
```

## Typical backend pairings

### LangGraph assist + v2 game (matches langgraph product path)

Terminal 1 — game API:

```bash
cd adventure-v2 && npm run dev:server
```

Terminal 2 — assist server:

```bash
cd adventure-langgraph && npm run assist:dev
```

Terminal 3 — webclient with map panel enabled:

```bash
cd adventure-webclient
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true \
VITE_WEBCLIENT_ASSIST_BACKEND=langgraph \
npm run dev
```

### NL research dashboard APIs

```bash
cd adventure-nl && npm run build && npm run web
```

```bash
cd adventure-webclient
VITE_WEBCLIENT_GAME_BACKEND=nl-dashboard \
VITE_WEBCLIENT_AGENT_BACKEND=nl-glue-browser \
VITE_WEBCLIENT_PROMPT_LAB=true \
VITE_WEBCLIENT_AUTOPLAY_CONTROLS=true \
npm run dev
```

### UI-only (no backends)

```bash
cd adventure-webclient
VITE_WEBCLIENT_GAME_BACKEND=mock \
VITE_WEBCLIENT_ASSIST_BACKEND=mock \
npm run dev
```

## Environment reference

| Variable | Default | Values |
| -------- | ------- | ------ |
| `VITE_WEBCLIENT_GAME_BACKEND` | `v2-http` | `v2-http`, `nl-dashboard`, `mock` |
| `VITE_WEBCLIENT_ASSIST_BACKEND` | `langgraph` | `langgraph`, `ag2`, `local-map-core`, `mock` |
| `VITE_WEBCLIENT_AGENT_BACKEND` | `none` | `nl-glue-browser`, `nl-glue-server`, `none` |
| `VITE_API_URL` | `http://127.0.0.1:8787` | Game API base |
| `VITE_ASSIST_URL` | `http://127.0.0.1:8790` | Assist server base |
| `VITE_NL_DASHBOARD_URL` | `https://127.0.0.1:8787` | NL dashboard when using `nl-dashboard` game backend |

Feature flags use the `VITE_WEBCLIENT_*` prefix — see [`webclient-feature-flags.json`](../../adventure-webclient/apps/web/webclient-feature-flags.json).

## Feature flag overrides (local)

**Query string:** `http://127.0.0.1:5175/?explorationMapMermaid=true&promptLab=true`

**sessionStorage:**

```js
sessionStorage.setItem("adventure-webclient-flag-explorationMapMermaid", "true");
location.reload();
```

## Tests

```bash
cd adventure-webclient && npm test
```

## Related docs

- [Webclient feature catalog](../features/webclient/feature-catalog.md)
- [Repository layout](repo-layout.md)
- [`.work-items/adventure-webclient/`](../../.work-items/adventure-webclient/index.md)
