# Quick start

From `adventure-langgraph/`:

```bash
npm install
npm start
```

That runs adventure-v2 `dev:server`, this package’s Vite app, and the assist HTTP server together. Open `<http://127.0.0.1:5174>` — shell → API at `<http://127.0.0.1:8787>`, draft map → assist at `<http://127.0.0.1:8790>` by default.

**Shell only** (API + assist already running elsewhere): `npm run dev`.

**Assist server only:** `npm run assist:dev`.

Optional — real Fortran output: from the repository root, `make adventure` so `./adventure` exists (see [Fortran oracle](../../developer/readme-shards/fortran-oracle.md)).

Override API origin if needed:

```bash
VITE_API_URL=http://127.0.0.1:8787 npm start
```

| Service | Default | Override |
| --- | --- | --- |
| CRT (Vite) | 5174 | Vite config |
| Game API | 8787 | `VITE_API_URL` |
| Assist | 8790 | `VITE_ASSIST_URL`, `ASSIST_SERVER_PORT` |

Optional Ollama:

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.2
npm start
```

Without `OLLAMA_URL`, navigator uses the heuristic adapter only.
