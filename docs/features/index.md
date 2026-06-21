# Features — adventure monorepo

**Audience:** Readers who want to understand what the product does — capabilities and behavior — without setup commands or CI detail.

Shared terms: [Glossary](../glossary/index.md).

## Migration status

| Surface | Maturity |
| --- | --- |
| LangGraph CRT + exploration map | Production play path |
| NL autoplay dashboard | Production research path |
| Unified webclient | Stub — panels migrating from langgraph |
| adventure-v2 API | Maintainer orchestration layer |
| adventure-ag2 | Research stub — Python bridge planned |

Play today: `docs/client/`. Build and migrate: `docs/developer/`.

## LangGraph CRT stack

- [v3 overview](v3-overview.md)
- [CRT shell](crt-shell.md)
- [Exploration map column](exploration-map-column.md)
- [Assist runtime](assist-runtime.md)
- [Cartographer fixtures](cartographer-fixtures.md)

## Unified webclient

- [Webclient (unified frontend)](webclient/index.md)

## NL autoplay

Natural-language play and autoplay dashboard — client guide: `docs/client/nl/quick-start.md` · package: `adventure-nl/README.md` · HTTP/SSE: `adventure-nl/openapi.yaml`.

## adventure-v2 capabilities

HTTP + SSE game API, cognition stubs, wire tests — package: `adventure-v2/README.md` · maintainer shards: `docs/developer/readme-adventure-v2/`.

## adventure-ag2

Multi-agent handoff stub — package: `adventure-ag2/README.md` · maintainer shards: `docs/developer/readme-adventure-ag2/`.

## Cloud deploy MVP

Hosted backend + webclient + optional desktop SLM bridge — [Cloud deploy MVP](cloud-deploy-mvp.md) · architecture: `docs/architecture/cloud-deploy-mvp/` · [ADR0017](../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md).
