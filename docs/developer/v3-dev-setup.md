# v3 dev setup

Setup for adventure-langgraph local development.

## Prerequisites

Shared [Prerequisites](../readme-shards/prerequisites.md) and [Fortran oracle](../readme-shards/fortran-oracle.md).

## Quick start

From `adventure-langgraph/`:

```bash
npm install
npm start
```

Open the CRT shell at port **5174** (default Vite dev server). The start script runs adventure-v2 API, Vite CRT, and assist server together.

**Shell only** (API + assist already running):

```bash
npm run dev
```

**Assist server only**:

```bash
npm run assist:dev
```

## Ports and overrides

| Service | Default | Override |
| --- | --- | --- |
| CRT (Vite) | 5174 | Vite config |
| Game API | 8787 | `VITE_API_URL` |
| Assist | 8790 | `VITE_ASSIST_URL`, `ASSIST_SERVER_PORT` |

## Optional Ollama

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.2
npm start
```

Without `OLLAMA_URL`, navigator uses the heuristic adapter only.

## Fortran oracle

When `./adventure` exists at repo root, adventure-v2 auto-selects the persistent Fortran oracle. Details: [Fortran oracle](../readme-shards/fortran-oracle.md).
