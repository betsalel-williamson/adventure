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

- Branch from **`feature/adventure-llm`** (the GitHub default branch). See [branch policy](docs/developer/branch-policy.md).
- **Do not** target `main` — that branch preserves the frozen historical Fortran source for clean-room comparison and authenticity proof.
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

Describe the change in the PR body using [`.github/pull_request_template.md`](.github/pull_request_template.md) so reviewers can follow intent without reading every line.

## Development environment

| Component   | Notes |
| ----------- | ----- |
| GNU Fortran | `gfortran` (see root `README.md` for install hints) |
| Node.js     | **24+** for TypeScript packages (see root `.nvmrc`) |
| Optional text models (NL stack) | `GEMINI_API_KEY`, MLX, or HTTP provider — see [`adventure-nl/.env.example`](adventure-nl/.env.example) |

Secrets belong in environment variables or a local `.env` file (gitignored),
never in commits.

### Git hooks (pre-commit)

This repo uses the [pre-commit](https://pre-commit.com/) Python framework for
all git hooks — secret scanning, commit message lint, docs checks, and
package-scoped lint/tests on changed paths. Config:
[`.pre-commit-config.yaml`](.pre-commit-config.yaml).

**One-time setup:**

```bash
brew install pre-commit          # or: pip install pre-commit
cd adventure-nl && npm install   # installs Husky → delegates to pre-commit
```

Install dependencies for packages you work in (as needed):

```bash
npm ci --prefix docs              # docs shard checks
npm ci --prefix adventure-nl      # NL lint-staged
npm ci --prefix adventure-langgraph
npm ci --prefix adventure-v2
```

**What runs on commit:**

| Hook | When |
| --- | --- |
| Trailing whitespace, YAML/JSON, merge conflicts | Always |
| gitleaks secret scan | Always |
| commitlint (conventional commits) | Every commit message |
| `docs-check` (mdcp) | `docs/` changes |
| adventure-nl lint-staged | `adventure-nl/` changes |
| adventure-langgraph lint-staged | `adventure-langgraph/` changes |
| adventure-v2 unit tests | `adventure-v2/` changes |

Run manually:

```bash
pre-commit run --all-files                    # everything
pre-commit run docs-check --all-files         # one hook
pre-commit run commitlint --hook-stage commit-msg --commit-msg-filename /path/to/msg
```

Skip hooks in an emergency: `SKIP=gitleaks,docs-check git commit …`

Alternative without Husky (e.g. Fortran-only work):

```bash
pre-commit install
pre-commit install --hook-type commit-msg
```

## Documentation

- **Start here:** [`docs/index.md`](docs/index.md) — play paths, tiers, and doc checks
- **Community:** [`docs/community.md`](docs/community.md) — bugs, doc edits, contribution checks
- **Branches:** [`docs/developer/branch-policy.md`](docs/developer/branch-policy.md) — `main` (frozen Fortran) vs `feature/adventure-llm` (default development)
- Root overview: [`README.md`](README.md)
- Natural-language / dashboard tooling: [`adventure-nl/README.md`](adventure-nl/README.md)
- adventure-langgraph sharded guides: [`docs/client/`](docs/client/index.md) (researcher), [`docs/features/`](docs/features/index.md), [`docs/developer/`](docs/developer/index.md)
- HTTP API (dashboard): [`adventure-nl/openapi.yaml`](adventure-nl/openapi.yaml) · overview [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
- Judge / demo walkthrough: [`DEMO.md`](DEMO.md)
- mdcp maintainer workflow: [`docs/developer/mdcp-workflow.md`](docs/developer/mdcp-workflow.md)
