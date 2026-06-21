# mdcp workflow

This repository uses [MDCP](https://www.npmjs.com/package/@bwilliamson/mdcp-cli) for sharded documentation under `docs/`.

## Commands

From `docs/`:

```bash
npm run docs:compile   # stitch shards → docs/_build/
npm run docs:check     # compile + refs + xrefs + markdownlint
npm run docs:context   # token-stripped export for agents
npm run docs:refs -- "topic" --format json
npm run docs:fetch     # cache agent index + task prompts (gitignored)
```

From repo root:

```bash
make docs-check
make docs-compile
```

## Authoring rules

- Edit **shard `.md` files only** — never hand-edit `docs/_build/` or `refs.json`
- Compile order comes from each guide's `index.md` link list under `## Sections` (or `## Terms` for glossary)
- Before cross-links, run `npm run docs:refs -- "topic" --format json` and use slugs from **compiled** output
- Legacy flat docs in `docs/architecture/` and `docs/decisions/` are outside `compileOrder`

## Config

- `docs/mdcp.config.json` — guides, lint presets, protocol pin (`v0.4.1`)
- Generated output: `docs/_build/` (gitignored)
- Task prompts cache: `.caches/mdcp/prompts/` (gitignored, via `docs:fetch`)

## CI

The `docs-check` workflow job runs `npm run docs:check` on pull requests.
