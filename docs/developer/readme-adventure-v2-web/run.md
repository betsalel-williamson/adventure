# Run

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
