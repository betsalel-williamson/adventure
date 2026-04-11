# Contributing

Thanks for helping improve this project. This repository combines a restored
Fortran build of Colossal Cave Adventure with optional TypeScript tooling
([`adventure-lm/`](adventure-lm/README.md)).

## Code of conduct

All participants are expected to follow the
[Contributor Covenant](https://www.contributor-covenant.org/) as described in
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Reporting bugs

Use [GitHub Issues](https://github.com/betsalel-williamson/adventure/issues).
Include:

- What you ran (exact commands)
- What you expected vs what happened
- OS and versions: `gfortran --version`, `node --version` (for `adventure-lm`)

## Pull requests

- Branch from `main` (or the default branch).
- Keep changes focused; prefer small, reviewable diffs.
- **TypeScript / dashboard (`adventure-lm/`):** from that directory run:
  - `npm install`
  - `npm run check` (TypeScript + tests)
  - `npm run lint` (if you touched JS/TS)
- **Fortran:** `make` from the repository root should succeed with no new
  warnings you can reasonably fix.

Describe the change in the PR body so reviewers can follow intent without
reading every line.

## Development environment

| Component   | Notes |
| ----------- | ----- |
| GNU Fortran | `gfortran` (see root `README.md` for install hints) |
| Node.js     | **20+** for `adventure-lm/` |
| Optional LLM | `GEMINI_API_KEY`, MLX, or HTTP provider — see [`adventure-lm/.env.example`](adventure-lm/.env.example) |

Secrets belong in environment variables or a local `.env` file (gitignored),
never in commits.

## Documentation

- Root overview: [`README.md`](README.md)
- LLM tooling and dashboard: [`adventure-lm/README.md`](adventure-lm/README.md)
- HTTP API (dashboard): [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
- Judge / demo walkthrough: [`DEMO.md`](DEMO.md)
