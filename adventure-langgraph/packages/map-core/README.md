# map-core — package README

## Overview

`@adventure-langgraph/map-core` provides **directed graph merge** and **Mermaid serialization** for draft exploration maps.

When the assist server is unreachable, the CRT client falls back to deterministic merge in this package so the map column can still update from transcript cues.

Fortran game state remains authoritative — merged graphs are **draft assistance** only.

## API surface

Key exports from [`packages/map-core/src/`](src):

- Directed graph types and merge helpers
- Mermaid diagram serialization for the exploration map column
- Exploration policy used by heuristic adapters (langgraph assist-server, ag2-bridge)

Consumed by:

- [`packages/assist-server`](../assist-server)
- [`apps/web`](../../apps/web) (client-side fallback)
- [`adventure-ag2/packages/ag2-bridge`](../../../adventure-ag2/packages/ag2-bridge)

## Testing

From `adventure-langgraph/`:

```bash
npm test -- packages/map-core
```

Vitest runs under the **`node`** project in [`vitest.config.ts`](../../vitest.config.ts).
