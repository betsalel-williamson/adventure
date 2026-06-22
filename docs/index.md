# Documentation — start here

Sharded guides for playing, evaluating, and maintaining Colossal Cave Adventure in this monorepo.

**Tiers:** [Client](client/index.md) = play and evaluate · [Features](features/index.md) = what the product does · [Developer](developer/index.md) = build, test, and migrate · [Glossary](glossary/index.md) = shared terms

## Play now

| Surface | Status | One command | Guide |
| --- | --- | --- | --- |
| **LangGraph CRT shell** | Ready today | `cd adventure-langgraph && npm install && npm start` | [Client quick start](client/quick-start.md) → port **5174** |
| **NL autoplay dashboard** | Ready today | `make install-nl && make run-autoplay-web` | [NL quick start](client/nl/quick-start.md) → port **8787** |
| **Unified webclient** | Stub / migrating | `cd adventure-webclient && npm install && npm start` | [Webclient guide](client/webclient/index.md) → port **5175** — use langgraph or NL for full play today |
| **Hosted APIs (preview)** | C1 smoke / operator | `curl -sf http://141.148.173.150:8787/health` | [Environments](developer/cloud-deploy-mvp/environments.md) — CRT via langgraph + `VITE_API_URL` |

**Classic Fortran only** (no Node): `make && ./adventure` from the repo root.

## Evaluate agents and research

- [Research workflows](client/research-workflows.md) — fixtures, probe posture, honest labeling
- [SLM configuration](client/slm-configuration.md) — Ollama and draft vs oracle truth
- [Features overview](features/index.md) — product capabilities by surface

## Contribute

- [Community guide](community.md) — bugs, doc edits, code checks, agents
- [CONTRIBUTING.md](../CONTRIBUTING.md) — pull request expectations and checks
- [Developer guide](developer/index.md) — mdcp workflow, local dev, migration catalogs

Doc checks from repo root: `make docs-check` · compile package READMEs: `make docs-publish-readmes`
