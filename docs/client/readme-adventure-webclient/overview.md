# Overview

> **For playing today:** use [adventure-langgraph](../adventure-langgraph/README.md) (CRT + map, port 5174) or [adventure-nl](../adventure-nl/README.md) (autoplay dashboard, port 8787). This package is the **unified shell stub** — panels are migrating behind feature flags.

Standalone **Vite + TypeScript** client for developing Colossal Cave UI **separate from backend choice**. Migrates panels from adventure-langgraph (CRT, Mermaid map, assist) and adventure-nl (autoplay dashboard, prompt lab, 3D grid) behind **feature flags** and env-driven backend adapters.

Backends evolve independently (v2 HTTP, LangGraph assist, AG2 handoff, NL glue). The webclient holds UI features behind flags so you can document, migrate, and point the same shell at different backends.

Client guide: [`docs/client/webclient/`](../docs/client/webclient/index.md)
