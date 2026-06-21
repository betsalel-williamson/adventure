# adventure-webclient — design

## Objective

Provide a backend-agnostic Vite shell that consolidates Colossal Cave UI features behind a unified feature-flag registry and env-driven backend adapters.

## Technical design

Aligns with [architecture standards](../../../.cursor/rules/standards-architecture.mdc): loose coupling via stable adapter interfaces; game truth remains Fortran oracle regardless of UI package.

```
adventure-webclient/apps/web/
  index.html              # Panel placeholders (hidden by default)
  webclient-feature-flags.json
  src/
    featureFlags.ts       # Query → sessionStorage → env → defaults
    backends/types.ts     # Game / assist / agent adapter kinds
    backends/config.ts      # Env resolution
    shell/applyChromeFromFlags.ts
    main.ts               # Bootstrap (grows as features migrate)
```

Backends (separate packages, unchanged):

- **Game:** adventure-v2 HTTP+SSE or adventure-nl dashboard server
- **Assist:** adventure-langgraph assist-server, adventure-ag2 bridge, or local map-core
- **Agent:** adventure-nl NL glue (browser or server orchestration)

### Key changes

#### API contracts

No new wire endpoints. Webclient consumes existing:

- v2: `POST /runs`, `POST /runs/:id/turns`, SSE `/runs/:id/events`
- Assist: `POST /assist/ingest`, `POST /assist/step`
- NL dashboard: `/api/*`, SSE `/events`

Adapter interfaces in `backends/types.ts` abstract base URLs and kind selection.

#### Data models

Feature flags defined in JSON — union of langgraph flags + NL panel flags. See [feature-catalog.md](../../docs/features/webclient/feature-catalog.md).

#### Component responsibilities

| Component | Role |
| --------- | ---- |
| `featureFlags.ts` | Resolve visibility for all panels |
| `backends/config.ts` | Select game/assist/agent targets from env |
| `shell/applyChromeFromFlags.ts` | Show/hide DOM regions |
| Future `api/gameClient.ts` | v2 SSE client (ported from langgraph) |
| Future `api/assistClient.ts` | Assist HTTP client (ported from langgraph) |
| Future `api/nlDashboardClient.ts` | NL REST/SSE (ported from dashboardApi.js) |

## Alternatives considered

| Alternative | Why not chosen |
| ----------- | -------------- |
| Keep two UIs forever | Duplicated panel work; hard to test AG2/LangGraph side by side |
| Move all UI into adventure-langgraph | NL dashboard is mature; forcing TypeScript rewrite blocks research |
| iframe embed NL dashboard | Poor focus/flag integration; doubles HTTP stacks |

## Out of scope

- Python AG2 subprocess adapter (stays in adventure-ag2)
- mdcp rename of v3 doc shards (separate cleanup)
- Removing adventure-langgraph apps/web before parity

## References

- [docs/features/webclient/](../../docs/features/webclient/index.md)
- [adventure-langgraph deferred](../adventure-langgraph/deferred.md)
- [adventure-nl source map](../../adventure-nl/docs/source-map.md)
