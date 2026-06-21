# Developer guide

**Audience:** Maintainers and contributors who build, test, migrate panels, and edit documentation shards.

Shared terms: [Glossary](../glossary/index.md).

Doc checks: `make docs-check` from repo root · compile package READMEs: `make docs-publish-readmes`

Play and evaluate: `docs/client/`. Product capabilities: `docs/features/`.

## Start here

- [Repository layout](repo-layout.md)
- [mdcp workflow](mdcp-workflow.md)
- [Legacy docs](legacy-docs.md)

## Run locally

### LangGraph CRT (v3)

- [v3 dev setup](v3-dev-setup.md)
- [LangGraph feature flags](langgraph-feature-flags.md)
- [v3 testing](v3-testing.md)

### Unified webclient

- [Webclient dev setup](webclient-dev-setup.md)
- [Webclient feature flags](webclient-feature-flags.md)
- [Webclient migration catalog](webclient-migration-catalog.md)

### Cloud deploy MVP

- [Cloud deploy MVP](cloud-deploy-mvp/index.md) — hosted runtime, inference relay, desktop agent (implementation: GitHub work graph)

### Other packages

- `adventure-v2/README.md` — shards in `docs/developer/readme-adventure-v2/`
- `adventure-nl/README.md` — maintainer shards in `docs/developer/readme-adventure-nl/` (layout, OWASP, env)
- `adventure-ag2/README.md` — shards in `docs/developer/readme-adventure-ag2/`

## Package readme shards

Edit shards under `docs/client/readme-adventure-*/` (play) and `docs/developer/readme-adventure-*/` (maintain), then `make docs-publish-readmes`.

| Package | Shard directory | Compiled README |
| --- | --- | --- |
| adventure-langgraph | `docs/client/readme-adventure-langgraph/` | `adventure-langgraph/README.md` |
| adventure-webclient | `docs/client/readme-adventure-webclient/` | `adventure-webclient/README.md` |
| adventure-nl | `docs/client/readme-adventure-nl/` | `adventure-nl/README.md` |
| adventure-v2 | `docs/developer/readme-adventure-v2/` | `adventure-v2/README.md` |
| adventure-ag2 | `docs/developer/readme-adventure-ag2/` | `adventure-ag2/README.md` |

Shared shards: `docs/client/readme-shards/`, `docs/developer/readme-shards/`.

## Test and CI

- [v3 testing](v3-testing.md) — langgraph verify gate
- `make docs-check` — mdcp compile, links, markdownlint

## Agent automation

- [Agent work-item tracking](agent-work-item-tracking.md)
