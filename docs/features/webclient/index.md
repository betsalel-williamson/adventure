# Webclient — unified frontend

The **adventure-webclient** package consolidates UI work from [`adventure-nl`](../../adventure-nl/README.md) (v1 autoplay dashboard) and [`adventure-langgraph`](../../adventure-langgraph/README.md) (CRT + exploration map) into one **backend-agnostic shell**.

## Goal

- **Preserve** existing frontend investments without losing them in package-specific silos
- **Document** each panel and visual one feature at a time (see [feature catalog](feature-catalog.md))
- **Rebuild** incrementally behind feature flags in `adventure-webclient/`
- **Decouple** UI development from backend choice so you can test LangGraph, AG2, or NL glue against the same chrome

## Personas

| Persona | Default surface | Typical flags |
| ------- | --------------- | ------------- |
| **Player** | CRT transcript + command line | `crtTranscript`, `statusStrip` |
| **Map explorer** | Beside-column draft map | `explorationMapMermaid` or `explorationMapGrid` |
| **Agent researcher** | Prompt lab, autoplay, cognition | `promptLab`, `autoplayControls`, `cognitionOrchestration` |
| **Operator / dev** | Feature flag panel | `featureFlagDevPanel` |

## Authority model (unchanged)

Fortran oracle text is **world truth**. Draft maps, hints, and agent output are **assistance** — label runs honestly when testing backends (see [Glossary: draft assistance](../glossary/draft-assistance.md)).

## Backend adapters

The webclient selects backends via env (not hard-coded package coupling):

| Adapter | Values | Used for |
| ------- | ------ | -------- |
| Game | `v2-http`, `nl-dashboard`, `mock` | Transcript + parser commands |
| Assist | `langgraph`, `ag2`, `local-map-core`, `mock` | Draft map + navigator hints |
| Agent | `nl-glue-browser`, `nl-glue-server`, `none` | Autoplay / planner loops |

Setup: [Webclient dev setup](../developer/webclient-dev-setup.md).

## Sections

- [Feature catalog](feature-catalog.md) — master inventory and migration status
- [CRT transcript panel](crt-transcript-panel.md)
- [Exploration map — Mermaid](exploration-map-mermaid.md)
- [NL autoplay dashboard (source)](nl-autoplay-dashboard.md)

## Related packages (source of truth today)

| Package | Role until migration completes |
| ------- | ------------------------------ |
| `adventure-langgraph/apps/web` | Production CRT + default exploration map |
| `adventure-nl/public/` | Full autoplay research dashboard |
| `adventure-v2` | Game HTTP + SSE API |
| `adventure-ag2` | AG2 handoff stub (assist backend candidate) |

## Work tracking

[`.work-items/adventure-webclient/`](../../.work-items/adventure-webclient/index.md)
