# adventure-ag2 — package README

## Prerequisites

- **Node.js 24+** — use repo [`.nvmrc`](../../.nvmrc) (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** (`gfortran`) — optional; build real oracle output with `make adventure` at repo root

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Documentation map (maintainers)

| Tier | Path | Audience |
| --- | --- | --- |
| Client guides | [`docs/client/`](../docs/client/index.md) | Play and evaluate surfaces |
| Features | [`docs/features/`](../docs/features/index.md) | Product capabilities |
| Developer | [`docs/developer/`](../docs/developer/index.md) | Maintainer setup and mdcp workflow |
| Glossary | [`docs/glossary/`](../docs/_build/client-v3.md#glossary) | Shared terms |
| Architecture | [`docs/architecture/`](../docs/architecture/overview.md) | Legacy flat design views |
| ADRs | [`docs/decisions/`](../docs/decisions/adventure-nl-cognition-adr-index.md) | Decision history |

**Client package READMEs**: compiled from `docs/client/readme-adventure-*/` into `adventure-langgraph/`, `adventure-webclient/`, and `adventure-nl/`.

**Developer package READMEs**: compiled from `docs/developer/readme-adventure-*/` into `adventure-v2/`, `adventure-ag2/`, and nested packages.

Edit shards under those directories, then run `npm run docs:compile` from `docs/` (or `make docs-publish-readmes` from repo root).

See [mdcp workflow](../docs/_build/developer.md#mdcp-workflow) and [legacy docs](../docs/_build/developer.md#legacy-docs) for the full readme guide inventory.

## Overview

Stub for [AG2](https://github.com/ag2ai/ag2) multi-agent orchestration against Colossal Cave Adventure. AG2 runs in Python; this package defines the **TypeScript contract** and a **heuristic LLM adapter** for CI and local development without a remote model.

**Related packages:**

- [`adventure-langgraph/`](../adventure-langgraph/) — LangGraph assist (current production path)
- [`adventure-v2/`](../adventure-v2/) — HTTP + SSE game API
- [`adventure-nl/`](../adventure-nl/) — full NL provider stack

See [Honest labeling](../docs/client/readme-shards/honest-labeling.md) — heuristic runs are not AG2 multi-agent LLM play.

## Quick start

```bash
cd adventure-ag2
npm install
npm test
```

## Handoff model

Each assist turn runs three conversational roles in sequence (mirroring AG2 group-chat handoff):

1. **Cartographer** — summarizes draft map state from transcript cues
2. **Navigator** — proposes the next compass move from the draft map
3. **Reviewer** — pass-through sanity check before the turn completes

Orchestrator: [`packages/ag2-bridge/src/ag2HandoffGraph.ts`](../../adventure-ag2/packages/ag2-bridge/src/ag2HandoffGraph.ts).

Swap the `Ag2LlmAdapter` implementation to route turns through real AG2 agents (Python subprocess or HTTP bridge).

## Adapters

| Adapter | When | Notes |
| --- | --- | --- |
| **Heuristic** (default) | CI, no model | Uses `@adventure-langgraph/map-core` exploration policy |
| **Subprocess AG2** | `AG2_PYTHON` + `OAI_CONFIG_LIST` | Spawn Python AG2 group chat; not wired yet |
| **HTTP SLM** | Ollama / OpenAI-compatible | Same env pattern as assist-server (`OLLAMA_URL`, …) |

Research workflows: [`docs/client/research-workflows.md`](../docs/_build/client-v3.md#research-workflows).

## Related docs

- LangGraph assist: [`adventure-langgraph`](../adventure-langgraph/README.md)
- ag2-bridge package: [`packages/ag2-bridge/README.md`](packages/ag2-bridge/README.md)
