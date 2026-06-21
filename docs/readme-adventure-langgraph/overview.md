# Overview

Thin **game-first** web client for Colossal Cave: hero CRT transcript (80×24), talking to the **adventure-v2** HTTP + SSE API.

**Default beside-CRT surface:** an **exploration map** column — a **draft** Mermaid directed graph of inferred places and compass moves from the visible transcript. A background **location agent** path (`POST /assist/ingest`) merges transcript lines; when assist is unreachable, the client falls back to deterministic merge in `@adventure-langgraph/map-core`.

**Legacy Assist** (posture, session signals, probe, JSON/Mermaid inspectors) stays in the tree but is **off by default** via feature flags.
