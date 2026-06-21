# Assist runtime

The **assist server** (`packages/assist-server`) merges CRT transcript into a per-run draft graph and optional navigator hints.

## Endpoints

### `POST /assist/ingest`

Accepts transcript text (+ optional graph patch). Returns updated `mapJson`, Mermaid, and `suggestedNextMove`.

Called by the exploration map column on each relevant transcript line when `locationAgent` is enabled.

### `POST /assist/step`

Merges transcript. With `advance: true` and probe enabled (server `ASSIST_PROBE_ENABLED` + client `mapProbe`), runs LangGraph **cartographer → navigator**.

Legacy Assist UI uses this for automated probe steps with **study first** confirmation when enabled.

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
