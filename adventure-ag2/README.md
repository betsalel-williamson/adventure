# adventure-ag2 — AG2 multi-agent handoff stub

Stub for [AG2](https://github.com/ag2ai/ag2) multi-agent orchestration against Colossal Cave Adventure. AG2 runs in Python; this package defines the **TypeScript contract** and a **heuristic LLM adapter** for CI and local development without a remote model.

**Related packages:**

- [`adventure-langgraph/`](../adventure-langgraph/) — LangGraph cartographer/navigator assist server (current production path)
- [`adventure-v2/`](../adventure-v2/) — HTTP + SSE game API
- [`adventure-nl/`](../adventure-nl/) — full NL provider stack (MLX, Ollama, Gemini)

## Multi-agent handoff model

Each assist turn runs three conversational roles in sequence (mirroring AG2 group-chat handoff):

1. **Cartographer** — summarizes draft map state from transcript cues
2. **Navigator** — proposes the next compass move from the draft map
3. **Reviewer** — pass-through sanity check before the turn completes

The handoff orchestrator lives in [`packages/ag2-bridge/src/ag2HandoffGraph.ts`](packages/ag2-bridge/src/ag2HandoffGraph.ts). Swap the `Ag2LlmAdapter` implementation to route turns through real AG2 agents (Python subprocess or HTTP bridge).

## Quick start

```bash
cd adventure-ag2
npm install
npm test
```

## Adapter selection (planned)

| Adapter | When | Notes |
| ------- | ---- | ----- |
| **Heuristic** (default) | CI, no model | Uses `@adventure-langgraph/map-core` exploration policy |
| **Subprocess AG2** | `AG2_PYTHON` + `OAI_CONFIG_LIST` | Spawn Python AG2 group chat; not wired yet |
| **HTTP SLM** | Ollama / OpenAI-compatible | Same env pattern as assist-server (`OLLAMA_URL`, …) |

Honest labeling: heuristic runs are **not** AG2 multi-agent LLM play — label them accordingly in research notes.

## Documentation

- Research workflows: [`docs/client/research-workflows.md`](../docs/client/research-workflows.md)
- LangGraph assist runtime: [`adventure-langgraph/README.md`](../adventure-langgraph/README.md)
