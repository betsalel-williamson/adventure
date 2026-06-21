# Adapters

| Adapter | When | Notes |
| --- | --- | --- |
| **Heuristic** (default) | CI, no model | Uses `@adventure-langgraph/map-core` exploration policy |
| **Subprocess AG2** | `AG2_PYTHON` + `OAI_CONFIG_LIST` | Spawn Python AG2 group chat; not wired yet |
| **HTTP SLM** | Ollama / OpenAI-compatible | Same env pattern as assist-server (`OLLAMA_URL`, …) |

Research workflows: [`docs/client/research-workflows.md`](../../client/research-workflows.md).
