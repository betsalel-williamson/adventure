# assist-server — package README

## Overview

HTTP assist server for adventure-langgraph. Merges CRT transcript into a per-run **draft graph** and optional navigator hints via LangGraph **cartographer → navigator**.

Runs as part of `npm start` in adventure-langgraph or standalone via `npm run assist:dev`.

## API reference

OpenAPI spec: [`openapi.yaml`](openapi.yaml) (default `http://127.0.0.1:8790`).

Request/response schemas live in `packages/assist-server/src/schemas.ts`. SLM and probe configuration: [Configuration](#configuration).

## Configuration

| Variable | Purpose |
| --- | --- |
| `ASSIST_SERVER_PORT` | Listen port (default **8790**) |
| `ASSIST_PROBE_ENABLED` | Allow `advance: true` on `/assist/step` |
| `OLLAMA_URL` | Enable Ollama adapter (for example `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Model name (for example `llama3.2`, `gemma2`) |

When `OLLAMA_URL` is unset, the **heuristic adapter** applies — not an SLM.

Client override: **`VITE_ASSIST_URL`** in the web shell.

## Testing

From `adventure-langgraph/`:

```bash
npm test -- packages/assist-server
npm run test:cucumber   # includes @assist wire features
```

Assist server restarts on source changes when using `npm run assist:dev` (`tsx watch` on `packages/assist-server` and imported `map-core` sources).
