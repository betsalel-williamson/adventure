# Responsibility

Vite dev shell for adventure-v2:

- Start a run via `POST /runs`, subscribe with `EventSource` to SSE
- **Game terminal** (`#game-terminal`) — CRT-style phosphor lane with echoed `>`, `[agent]`, oracle output
- Optional **raw SSE log**, phase/reconcile/checkpoint panels, cognition trace, agent structure (Mermaid)
- Interactive command input and **stub autoplay** (deterministic command cycle, no LLM)
- **Persisted shell snapshot** in `localStorage` with reconnect on refresh when run still exists

Requires the HTTP API (`npm run dev:server` from adventure-v2 root, or `npm run dev` for both).
