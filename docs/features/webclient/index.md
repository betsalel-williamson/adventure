# Webclient — product overview

The **adventure-webclient** package is the unified browser shell for Colossal Cave — one frontend that can mount CRT play, draft exploration maps, and research panels behind feature flags while swapping game, assist, and agent backends.

End-user personas and outcomes: [Client guide — webclient](../../client/webclient/index.md).

## Authority model

| Layer | Role |
| ----- | ---- |
| **Fortran oracle** | Simulation of truth |
| **Game backend** | v2 HTTP+SSE or NL dashboard — delivers oracle text to the CRT |
| **Assist backend** | LangGraph assist, AG2 handoff, or local map-core — draft graph and hints |
| **Agent backend** | NL glue (browser or server) — autoplay and planner loops |
| **Webclient** | Renders transcript and optional panels — never canonical game text |

Map and assist features consume **user-visible** transcript streams and produce **draft assistance** only.

## Default runtime (stub)

| Service | Default URL |
| ------- | ----------- |
| Webclient shell | `http://127.0.0.1:5175` |
| Game API (when `v2-http`) | `http://127.0.0.1:8787` |
| Assist server (when `langgraph`) | `http://127.0.0.1:8790` |

Production CRT + map today: `adventure-langgraph/` (`npm start`, port **5174**).

## Feature flags

Build defaults: `adventure-webclient/apps/web/webclient-feature-flags.json`. Query, sessionStorage, and Vite env overrides apply for local regression. Operator reference: [Developer — webclient feature flags](../../developer/webclient-feature-flags.md).

## Sections

- [CRT transcript](crt-transcript.md)
- [Exploration map — Mermaid](exploration-map-mermaid.md)
- [Exploration map — 3D grid](exploration-map-grid.md)
- [Backend adapters](backend-adapters.md)
- [NL dashboard lineage](nl-dashboard-lineage.md)

Migration status: [Developer — migration catalog](../../developer/webclient-migration-catalog.md)
