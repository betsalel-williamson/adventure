# Overview

Play Colossal Cave in your browser with a classic **CRT transcript** and a **draft exploration map** beside it.

## How it works

Thin **game-first** web client: hero CRT panel (80×24), talking to the **adventure-v2** HTTP + SSE API.

**Default beside-CRT surface:** an **exploration map** column — a **draft** Mermaid graph of inferred places and compass moves from the visible transcript. A background assist path merges transcript lines; when assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core`.

**Legacy Assist** panels (posture, session signals, probe, JSON/Mermaid inspectors) stay in the tree but are **off by default** via feature flags.

Play guide: [`docs/client/quick-start.md`](../docs/client/quick-start.md)
