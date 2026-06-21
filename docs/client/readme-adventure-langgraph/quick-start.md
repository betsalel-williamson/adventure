# Quick start

```bash
cd adventure-langgraph
npm install
npm start
```

Open `<http://127.0.0.1:5174>`. Play guide: [`docs/client/quick-start.md`](../docs/client/quick-start.md). Maintainer setup: [`docs/developer/v3-dev-setup.md`](../docs/developer/v3-dev-setup.md).

**Shell only** (API + assist already running): `npm run dev`. **Assist only:** `npm run assist:dev`.

| Service | Default |
| --- | --- |
| CRT (Vite) | 5174 |
| Game API | 8787 |
| Assist | 8790 |

Optional Ollama: set `OLLAMA_URL` and `OLLAMA_MODEL` before `npm start`. Without Ollama, navigator uses the heuristic adapter only.
