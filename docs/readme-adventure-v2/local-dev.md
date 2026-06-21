# Local dev

From `adventure-v2/` after `npm install`:

```bash
npm run dev
```

Starts API (**8787**) and web shell (**5173**). Open `<http://localhost:5173>`.

Split processes:

```bash
npm run dev:server   # API only
npm run dev:web      # Vite only
VITE_API_URL=http://127.0.0.1:9999 npm run dev:web
```

Optional CORS allowlist:

```bash
ADV_V2_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 npm run dev:server
```

### Troubleshooting empty game terminal

| Symptom | Check |
| --- | --- |
| Nothing after Send | SSE connected? `VITE_API_URL` matches API used for `POST /runs` |
| Raw SSE but empty CRT | `[parse error]` in raw panel — wire schema mismatch |
| Only `OK.` | Oracle synthetic — build `./adventure` or set process script |
| Reconcile in CRT | By design not copied to game terminal — use raw SSE log |

**Autoplay** in the dev shell is a **deterministic stub** (`stubAutoplayPlanner.ts`), not an LLM.
