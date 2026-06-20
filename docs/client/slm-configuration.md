# SLM configuration

Configure local models for **navigator** hints on the assist path.

## Heuristic vs SLM

| Mode | When | Label honestly |
| --- | --- | --- |
| **Heuristic** | `OLLAMA_URL` unset | Rule-based — **not** an SLM |
| **Ollama SLM** | `OLLAMA_URL` set | Local model (Llama, Gemma, …) |

Navigator output is **draft assistance** — suggested compass moves are not auto-played unless you enable probe mode (see [Research workflows](research-workflows.md)).

## Enable Ollama

With [Ollama](https://ollama.com/) running locally:

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.2   # optional
cd adventure-v3 && npm start
```

## What the SLM affects

On the default v3 surface, SLM adapters primarily influence **suggested next move** on assist ingest/step — not free-form natural-language command parsing (that lives in adventure-nl).

## UI and copy

Map and assist copy should say **draft** or **hint**. Never present navigator text as canonical room descriptions from the game.
