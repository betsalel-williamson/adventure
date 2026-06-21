# Configuration

| Variable | Purpose |
| --- | --- |
| `ASSIST_SERVER_PORT` | Listen port (default **8790**) |
| `ASSIST_PROBE_ENABLED` | Allow `advance: true` on `/assist/step` |
| `OLLAMA_URL` | Enable Ollama adapter (for example `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Model name (for example `llama3.2`, `gemma2`) |

When `OLLAMA_URL` is unset, the **heuristic adapter** applies — not an SLM.

Client override: **`VITE_ASSIST_URL`** in the web shell.
