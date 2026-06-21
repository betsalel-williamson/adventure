# Backend adapters

The webclient decouples **presentation** from **backend choice** through three adapter kinds selected by environment variables.

## Game adapter

Delivers oracle transcript and accepts parser commands.

| Value | Backend |
| ----- | ------- |
| `v2-http` | adventure-v2 HTTP + SSE (default) |
| `nl-dashboard` | adventure-nl embedded dashboard server |
| `mock` | No network — UI fixtures |

Env: `VITE_WEBCLIENT_GAME_BACKEND`, `VITE_API_URL`, `VITE_NL_DASHBOARD_URL`

## Assist adapter

Produces draft map merges and navigator hints.

| Value | Backend |
| ----- | ------- |
| `langgraph` | adventure-langgraph assist server (default) |
| `ag2` | adventure-ag2 handoff stub |
| `local-map-core` | In-browser map-core merge only |
| `mock` | Frozen fixture graph |

Env: `VITE_WEBCLIENT_ASSIST_BACKEND`, `VITE_ASSIST_URL`

## Agent adapter

Runs NL autoplay / planner loops (research mode).

| Value | Backend |
| ----- | ------- |
| `none` | No agent loop (default) |
| `nl-glue-browser` | In-browser NL glue + vendor APIs |
| `nl-glue-server` | Server-orchestrated NL glue (MLX path) |
| `inference-relay` | **Planned (cloud MVP)** — server `/inference/*`; optional paired desktop SLM |

Env: `VITE_WEBCLIENT_AGENT_BACKEND`

## Why adapters matter

WHEN you test LangGraph assist against AG2 or NL autoplay THEN you can keep the same visible panels and swap backends without forking the UI package.

Maintainer setup: [Developer — webclient dev setup](../../developer/webclient-dev-setup.md)

Glossary: [Webclient](../../glossary/webclient.md) · [Assist server](../../glossary/assist-server.md)
