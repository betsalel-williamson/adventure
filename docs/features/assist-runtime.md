# Assist runtime

The **assist server** (`packages/assist-server`) merges CRT transcript into a per-run draft graph and optional navigator hints.

**API reference:** [`openapi.yaml`](../../adventure-langgraph/packages/assist-server/openapi.yaml) (default `http://127.0.0.1:8790`).

## SLM configuration

| Variable | Purpose |
| --- | --- |
| `OLLAMA_URL` | Enable Ollama adapter (for example `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Model name (for example `llama3.2`, `gemma2`) |
| `ASSIST_PROBE_ENABLED` | Allow `advance: true` on `/assist/step` |
| `ASSIST_SERVER_PORT` | Listen port (default 8790) |

When `OLLAMA_URL` is unset, the **heuristic adapter** applies — not an SLM.

## LangGraph scope

Cartographer and navigator run server-side only. They do not replace the hero CRT or imply full autonomy on the default surface.
