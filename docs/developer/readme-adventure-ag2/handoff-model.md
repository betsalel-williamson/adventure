# Handoff model

Each assist turn runs three conversational roles in sequence (mirroring AG2 group-chat handoff):

1. **Cartographer** — summarizes draft map state from transcript cues
2. **Navigator** — proposes the next compass move from the draft map
3. **Reviewer** — pass-through sanity check before the turn completes

Orchestrator: [`packages/ag2-bridge/src/ag2HandoffGraph.ts`](../../adventure-ag2/packages/ag2-bridge/src/ag2HandoffGraph.ts).

Swap the `Ag2LlmAdapter` implementation to route turns through real AG2 agents (Python subprocess or HTTP bridge).
