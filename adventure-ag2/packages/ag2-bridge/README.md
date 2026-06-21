# ag2-bridge — package README

## Overview

TypeScript contract and heuristic adapter for AG2-style multi-agent handoff against Colossal Cave draft maps.

Reuses `@adventure-langgraph/map-core` for exploration policy. Real [AG2](https://github.com/ag2ai/ag2) integration will route `Ag2LlmAdapter` through a Python subprocess bridge.

Parent package: [`adventure-ag2/README.md`](../../README.md).

## Handoff graph

Implementation: [`src/ag2HandoffGraph.ts`](../../adventure-ag2/packages/ag2-bridge/src/ag2HandoffGraph.ts)

Sequence per turn: **cartographer → navigator → reviewer**.

The default **heuristic** `Ag2LlmAdapter` satisfies CI without remote models. Replace with subprocess or HTTP adapters when Python AG2 orchestration lands.

## Testing

From `adventure-ag2/`:

```bash
npm test
```

Vitest covers handoff graph and heuristic adapter behavior.
