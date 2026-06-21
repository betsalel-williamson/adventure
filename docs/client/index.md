# Client guide

**Audience:** Players, map explorers, and agent researchers who want to run surfaces and evaluate behavior — not maintain the codebase.

Shared terms: [Glossary](../glossary/index.md).

## What to run today

| Surface | Status | Quick start |
| --- | --- | --- |
| **LangGraph CRT** | Ready | [Quick start](quick-start.md) — `cd adventure-langgraph && npm start` → port 5174 |
| **NL autoplay dashboard** | Ready | [NL quick start](nl/quick-start.md) — `make run-autoplay-web` → port 8787 |
| **Unified webclient** | Stub / migrating | [Webclient guide](webclient/index.md) — use langgraph or NL for full play today |

The unified webclient is the long-term shell; langgraph and NL are the surfaces to use for production play and research now.

## Choose your path

- [About this guide](about-this-guide.md) — personas and what you can do
- [Quick start — LangGraph CRT](quick-start.md)
- [Quick start — NL dashboard](nl/quick-start.md)
- [Webclient guide](webclient/index.md) — unified shell (migration in progress)
- [Choose your surface](webclient/choose-your-surface.md) — player vs map explorer vs researcher

## Learn more

- [Exploration map guide](exploration-map-guide.md) — read the draft graph beside the CRT
- [SLM configuration](slm-configuration.md) — Ollama and honest labeling
- [Research workflows](research-workflows.md) — fixtures and probe mode

More detail: `docs/features/` (product capabilities) · `docs/developer/` (maintainer setup)
