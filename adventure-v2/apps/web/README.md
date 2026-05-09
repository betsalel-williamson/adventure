# adventure-v2 web app (slice 2 shell)

## Responsibility

Minimal console-style page: start a run via `POST /runs`, subscribe with `EventSource` to `GET /runs/:runId/events`, then `POST /runs/:runId/turns` with a sample action. Displays streamed turn JSON and the latest control phase from phase events.

## Run

Requires the HTTP API (`npm run dev:server` from `adventure-v2/` root).

```bash
# from adventure-v2/
npm run dev:web
```

Override API origin (default `http://127.0.0.1:8787`):

```bash
VITE_API_URL=http://localhost:8787 npm run dev:web
```

Stack: Vite, TypeScript, vanilla DOM. Root config: [`../../vite.config.ts`](../../vite.config.ts).
