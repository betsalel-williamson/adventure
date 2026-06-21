# LangGraph feature flags

Operational reference for adventure-langgraph client flags.

## Defaults and resolution

Defaults live in [`apps/web/langgraph-feature-flags.json`](../../adventure-langgraph/apps/web/langgraph-feature-flags.json). Resolution runs in [`apps/web/src/featureFlags.ts`](../../adventure-langgraph/apps/web/src/featureFlags.ts):

1. **Vite env** overrides config defaults
2. **Query string** or **`sessionStorage`** (`adventure-langgraph-flag-<name>`) overrides for local regression

## Flag table

| Flag | Env | Default |
| --- | --- | --- |
| `explorationMap` | `VITE_LANGGRAPH_EXPLORATION_MAP` | on |
| `assistPanels` | `VITE_LANGGRAPH_ASSIST_PANELS` | off |
| `mapProbe` | `VITE_LANGGRAPH_MAP_PROBE` | off |
| `mapInspectors` | `VITE_LANGGRAPH_MAP_INSPECTORS` | off |
| `locationAgent` | `VITE_LANGGRAPH_LOCATION_AGENT` | on |

## Examples

Re-enable legacy Assist chrome:

```bash
VITE_LANGGRAPH_ASSIST_PANELS=true VITE_LANGGRAPH_MAP_PROBE=true VITE_LANGGRAPH_MAP_INSPECTORS=true npm run dev
```

Assist server: set **`ASSIST_PROBE_ENABLED=true`** to allow `advance: true` on **`POST /assist/step`** (still requires client `mapProbe`).

Product defaults (player-facing): [Features — CRT shell](../features/crt-shell.md)
