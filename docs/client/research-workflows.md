# Research workflows

Patterns for evaluating SLMs and LLMs against the v3 play surface.

## Manual play + observation

1. Build Fortran oracle: `make adventure`
2. Start v3 with optional Ollama ([SLM configuration](slm-configuration.md))
3. Play manually; record transcript, map snapshots, and which hints helped
4. Separate **oracle text** from **draft map/hints** in notes

## Fixture-based eval

Use `@adventure-langgraph/cartographer-fixtures` JSON cases with `acceptableResponses` to benchmark ingest output without clicking through full games.

Run package tests from `adventure-langgraph/`:

```bash
npm test -- packages/assist-server/src/cartographerFixtureIngest.test.ts
```

## Map probe (advanced, off by default)

Automated probe steps require:

- Server: `ASSIST_PROBE_ENABLED=true`
- Client flags: `VITE_LANGGRAPH_MAP_PROBE=true` (and related Assist panels if using legacy UI)
- **Study first** confirmation when that posture is enabled

Probe sends assist-backed moves — label runs as **scripted probe**, not autonomous LLM play (aligned with user story US-3-1 in `.work-items/adventure-langgraph/`).

## Agent framework roadmap

**Current path:** HTTP + LangGraph assist in [`adventure-langgraph/`](../../adventure-langgraph/README.md) (`packages/assist-server`).

**AG2 stub:** [`adventure-ag2/`](../../adventure-ag2/README.md) defines a multi-agent handoff contract (cartographer → navigator → reviewer) with a heuristic adapter for CI. Real AG2 ([ag2ai/ag2](https://github.com/ag2ai/ag2)) Python orchestration is planned via subprocess bridge; set `AG2_PYTHON` and `OAI_CONFIG_LIST` when that adapter lands.

## Unified frontend (webclient)

For UI experiments decoupled from a specific backend, use [`adventure-webclient/`](../../adventure-webclient/README.md): enable panels via feature flags and point at LangGraph assist, AG2, v2 game API, or NL dashboard with env vars. Catalog: [Webclient feature catalog](../features/webclient/feature-catalog.md).

## Work items for agents

When driving doc or code tasks from issues, set `WORK_ITEM_LOOKUP` to `docs/developer/agent-work-item-tracking.md`.
