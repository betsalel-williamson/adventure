# Community guide

How to report problems, improve docs, contribute code, and run agent-assisted tasks.

## Code of conduct

All participants follow the [Contributor Covenant](../../CODE_OF_CONDUCT.md).

## Report bugs

Open a [GitHub Issue](https://github.com/betsalel-williamson/adventure/issues) with:

- Exact commands you ran
- Expected vs actual behavior
- OS and versions (`gfortran --version`, `node --version`)

## Fix documentation

1. Edit shard `.md` files under `docs/client/`, `docs/features/`, `docs/developer/`, or `docs/glossary/`.
2. For package READMEs, edit `docs/client/readme-adventure-*/` or `docs/developer/readme-adventure-*/` shards — not compiled `adventure-*/README.md` files.
3. Verify: `make docs-check` from repo root (or `npm run docs:check` from `docs/`).
4. Publish READMEs: `make docs-publish-readmes`.

Maintainer workflow: [mdcp workflow](developer/mdcp-workflow.md).

## Contribute code

See [CONTRIBUTING.md](../../CONTRIBUTING.md). Package verify matrix:

| Package | Check |
| --- | --- |
| `adventure-nl/` | `npm run check` |
| `adventure-langgraph/` | `npm run verify` |
| `adventure-webclient/` | `npm test` |
| `adventure-ag2/` | `npm test` |
| Fortran | `make` at repo root |

## Agent-assisted work

Set `WORK_ITEM` to a GitHub Issue number or URL. Load scope with `gh issue view <number>`.

Conventions: [Agent work-item tracking](developer/agent-work-item-tracking.md).

**Tracker policy:** new work uses **GitHub Issues** + [manifest.json](../scripts/work-registry/manifest.json). [`.work-items/`](../.work-items/README.md) is a backup and design archive — not a parallel tracker.

## Start here

- [Documentation index](index.md) — play paths and doc tiers
- [Client guide](client/index.md) — play and evaluate
- [Developer guide](developer/index.md) — build and migrate
