# web — package README

## Responsibility

Vite dev shell for adventure-v2:

- Start a run via `POST /runs`, subscribe with `EventSource` to SSE
- **Game terminal** (`#game-terminal`) — CRT-style phosphor lane with echoed `>`, `[agent]`, oracle output
- Optional **raw SSE log**, phase/reconcile/checkpoint panels, cognition trace, agent structure (Mermaid)
- Interactive command input and **stub autoplay** (deterministic command cycle, no LLM)
- **Persisted shell snapshot** in `localStorage` with reconnect on refresh when run still exists

Requires the HTTP API (`npm run dev:server` from adventure-v2 root, or `npm run dev` for both).

## Run

From `adventure-v2/`:

```bash
npm run dev:web
```

Override API origin (default `http://127.0.0.1:8787`):

```bash
VITE_API_URL=http://localhost:8787 npm run dev:web
```

Stack: Vite, TypeScript, vanilla DOM. Root config: [`vite.config.ts`](../../adventure-v2/vite.config.ts).

Key modules: [`wireDisplay.ts`](../../adventure-v2/apps/web/src/wireDisplay.ts), [`gameTerminalBuffer.ts`](../../adventure-v2/apps/web/src/gameTerminalBuffer.ts), [`stubAutoplayPlanner.ts`](../../adventure-v2/apps/web/src/stubAutoplayPlanner.ts).
