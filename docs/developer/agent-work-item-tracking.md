# Agent work-item tracking

Conventions for coding agents loading scope from the issue tracker.

## Tracker

- **Host:** GitHub Issues — [betsalel-williamson/adventure](https://github.com/betsalel-williamson/adventure)
- **ID format:** issue number (`#42`) or full issue URL

## Loading scope

Set in task prompts:

- **`WORK_ITEM`** — ticket identifier or URL for the current branch
- **`WORK_ITEM_LOOKUP`** — `docs/developer/agent-work-item-tracking.md` (this shard)

Agents load issue body and acceptance criteria via:

- `gh issue view <number>`
- GitHub MCP tools when available

## Branch discipline

- **One WORK_ITEM per branch** — branch from updated `main` before editing
- Shards describe **current behavior**; breaking changes belong in the PR/changeset, not feature/client guides
- Planning context may still live in `.work-items/` until migrated to mdcp shards

## mdcp task prompts

After `npm run docs:fetch`, load task-type prompts from `.caches/mdcp/prompts/`:

- `feature-level-task.prompt.md`
- `doc-only-task.prompt.md`
- `design-architecture-task.prompt.md`
- `ux-task.prompt.md`
- `review-task.prompt.md`

Fill the **Replace before sending** block at the top of each prompt before use.
