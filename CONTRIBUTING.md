# Contributing

Thanks for helping improve this project. This repository combines a restored
Fortran build of Colossal Cave Adventure with optional TypeScript tooling in
[`adventure-nl/`](adventure-nl/README.md). The folder name **`adventure-nl`** uses
**NL** for **natural language** (player text, prompts, planner glue—not a
specific model brand). Configuration for that stack uses the **`ADVENTURE_NL_*`**
environment prefix (see `adventure-nl/.env.example`).

## Code of conduct

All participants are expected to follow the
[Contributor Covenant](https://www.contributor-covenant.org/) as described in
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Reporting bugs

Use [GitHub Issues](https://github.com/betsalel-williamson/adventure/issues).
Include:

- What you ran (exact commands)
- What you expected vs what happened
- OS and versions: `gfortran --version`, `node --version` (for `adventure-nl`)

## Pull requests

- Branch from `main` (or the default branch).
- Keep changes focused; prefer small, reviewable diffs.
- **TypeScript / dashboard (`adventure-nl/`):** from that directory run:
  - `npm install`
  - `npm run check` (TypeScript + tests)
  - `npm run lint` (if you touched JS/TS)
- **adventure-langgraph/:** `npm run verify` when you change the CRT shell or assist packages
- **adventure-ag2/:** `npm test` when you change the AG2 handoff stub
- **adventure-webclient/:** `npm test` when you change the unified frontend shell or feature flags
- **Documentation shards (`docs/glossary/`, `docs/features/`, `docs/developer/`, `docs/client/`):** from `docs/` run `npm run docs:check` (or `make docs-check` from repo root)
- **Fortran:** `make` from the repository root should succeed with no new
  warnings you can reasonably fix.

Describe the change in the PR body so reviewers can follow intent without
reading every line.

## Development environment

| Component   | Notes |
| ----------- | ----- |
| GNU Fortran | `gfortran` (see root `README.md` for install hints) |
| Node.js     | **24+** for TypeScript packages (see root `.nvmrc`) |
| Optional text models (NL stack) | `GEMINI_API_KEY`, MLX, or HTTP provider — see [`adventure-nl/.env.example`](adventure-nl/.env.example) |

Secrets belong in environment variables or a local `.env` file (gitignored),
never in commits.

## Documentation

- **Start here:** [`docs/index.md`](docs/index.md) — play paths, tiers, and doc checks
- Root overview: [`README.md`](README.md)
- Natural-language / dashboard tooling: [`adventure-nl/README.md`](adventure-nl/README.md)
- adventure-langgraph sharded guides: [`docs/client/`](docs/client/index.md) (researcher), [`docs/features/`](docs/features/index.md), [`docs/developer/`](docs/developer/index.md)
- HTTP API (dashboard): [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
- Judge / demo walkthrough: [`DEMO.md`](DEMO.md)
- mdcp maintainer workflow: [`docs/developer/mdcp-workflow.md`](docs/developer/mdcp-workflow.md)
