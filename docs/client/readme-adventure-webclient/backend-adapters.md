# Backend adapters

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_WEBCLIENT_GAME_BACKEND` | `v2-http` | `v2-http` · `nl-dashboard` · `mock` |
| `VITE_WEBCLIENT_ASSIST_BACKEND` | `langgraph` | `langgraph` · `ag2` · `local-map-core` · `mock` |
| `VITE_WEBCLIENT_AGENT_BACKEND` | `none` | `nl-glue-browser` · `nl-glue-server` · `none` |
| `VITE_API_URL` | `http://127.0.0.1:8787` | Game API base |
| `VITE_ASSIST_URL` | `http://127.0.0.1:8790` | Assist server base |
| `VITE_NL_DASHBOARD_URL` | `https://127.0.0.1:8787` | NL dashboard when `game=nl-dashboard` |

Example — LangGraph assist against running servers:

```bash
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true \
VITE_WEBCLIENT_ASSIST_BACKEND=langgraph \
npm run dev
```

Example — AG2 assist backend (when wired):

```bash
VITE_WEBCLIENT_ASSIST_BACKEND=ag2 npm run dev
```
