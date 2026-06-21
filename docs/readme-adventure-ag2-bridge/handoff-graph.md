# Handoff graph

Implementation: [`src/ag2HandoffGraph.ts`](../../adventure-ag2/packages/ag2-bridge/src/ag2HandoffGraph.ts)

Sequence per turn: **cartographer → navigator → reviewer**.

The default **heuristic** `Ag2LlmAdapter` satisfies CI without remote models. Replace with subprocess or HTTP adapters when Python AG2 orchestration lands.
