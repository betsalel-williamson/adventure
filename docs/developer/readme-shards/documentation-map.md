# Documentation map

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../../client/index.md) | Play and evaluate surfaces |
| Features | [`docs/features/`](../../features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../../developer/index.md) | Maintainer setup and mdcp workflow |
| Glossary | [`docs/glossary/`](../../glossary/index.md) | Shared terms |
| Architecture | [`docs/architecture/`](../../architecture/overview.md) | Legacy flat design views |
| ADRs | [`docs/decisions/`](../../decisions/adventure-nl-cognition-adr-index.md) | Decision history |

**Client package READMEs** (this file may be one): compiled from `docs/client/readme-adventure-*/` into `adventure-langgraph/`, `adventure-webclient/`, and `adventure-nl/`.

**Developer package READMEs**: compiled from `docs/developer/readme-adventure-*/` into `adventure-v2/`, `adventure-ag2/`, and nested packages.

Edit shards under those directories, then run `npm run docs:compile` from `docs/`.
