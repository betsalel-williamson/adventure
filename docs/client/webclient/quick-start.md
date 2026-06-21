# Quick start — webclient

Play or observe Colossal Cave through the unified webclient shell.

## Prerequisites

- Node.js **24+** (repo `.nvmrc`)
- Optional: `make adventure` at repo root for real Fortran room text
- Optional: running game API and assist server when testing live backends — [Developer — backend pairings](../../developer/webclient-dev-setup.md)

## Start the shell

```bash
cd adventure-webclient
npm install
npm run dev
```

Open `http://127.0.0.1:5175`.

The stub shell shows enabled feature flags and backend summary. Full play wiring lands incrementally — until CRT migration completes, use [langgraph quick start](../quick-start.md) or [adventure-nl README](../../../adventure-nl/README.md) for production play.

## Enable panels for your persona

Add query overrides or env vars before `npm run dev`. Example — player + Mermaid map:

```bash
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true npm run dev
```

Or in the browser address bar: `?explorationMapMermaid=true`

See [Choose your surface](choose-your-surface.md) for persona-specific flag sets.

## Play (when CRT is migrated)

1. Read room text in the **CRT transcript**.
2. Type parser commands (`N`, `TAKE KEYS`, `INVENTORY`, …).
3. IF the exploration map is enabled THEN watch it update as **draft** inferred topology — not privileged game state.

## Next steps

- [Playing the game](playing-the-game.md)
- [Reading the exploration map](reading-the-exploration-map.md)
- [Evaluating agent behavior](evaluating-agent-behavior.md)
