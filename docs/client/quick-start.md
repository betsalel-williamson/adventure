# Quick start

Play Colossal Cave in the adventure-langgraph CRT shell.

## Prerequisites

Shared [Prerequisites](../developer/readme-shards/prerequisites.md) and [Fortran oracle](../developer/readme-shards/fortran-oracle.md). Package quick reference: [adventure-langgraph README](../../adventure-langgraph/README.md).

## Start the stack

```bash
cd adventure-langgraph
npm install
npm start
```

Open the CRT shell at port **5174**.

## Play

1. Read room text in the **CRT transcript** (hero panel).
2. Type classic parser commands (`N`, `TAKE KEYS`, `INVENTORY`, …).
3. Watch the **exploration map** column update as you move — it shows **draft** inferred places, not privileged game state.

## Status and errors

The status strip reports API and oracle health. If the assist server is down, the map may fall back to client-side merge or show the last-good diagram — game commands still reach the oracle when the API is healthy.

## Next steps

- [Exploration map guide](exploration-map-guide.md) — how to read the draft graph
- [SLM configuration](slm-configuration.md) — Ollama and honest labeling
- [Research workflows](research-workflows.md) — fixtures and probe mode
