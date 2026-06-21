# API surface

Key exports from [`packages/map-core/src/`](../../adventure-langgraph/packages/map-core/src/):

- Directed graph types and merge helpers
- Mermaid diagram serialization for the exploration map column
- Exploration policy used by heuristic adapters (langgraph assist-server, ag2-bridge)

Consumed by:

- [`packages/assist-server`](../../adventure-langgraph/packages/assist-server)
- [`apps/web`](../../adventure-langgraph/apps/web) (client-side fallback)
- [`adventure-ag2/packages/ag2-bridge`](../../adventure-ag2/packages/ag2-bridge)
