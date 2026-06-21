# Agent work-item tracking

Conventions for coding agents loading scope from the issue tracker.

## Tracker

- **Host:** GitHub Issues — [betsalel-williamson/adventure](https://github.com/betsalel-williamson/adventure)
- **Board:** [Adventure project #3](https://github.com/users/betsalel-williamson/projects/3) — all programs (filter by **Program** field)
- **Catalog:** [Work registry](work-registry/index.md) — [`scripts/work-registry/manifest.json`](../../scripts/work-registry/manifest.json)
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
- New work uses **GitHub Issues** for scope; legacy `.work-items/` files are historical only
- Package `README.md` files are compiled from `docs/client/readme-adventure-*/` and `docs/developer/readme-adventure-*/` shards — see [mdcp workflow](mdcp-workflow.md)

## Cloud deploy MVP epic

Multi-issue program: epic [#3](https://github.com/betsalel-williamson/adventure/issues/3) · milestone [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1).

| Resource | Link |
| --- | --- |
| Work graph | [work-graph.md](../architecture/cloud-deploy-mvp/work-graph.md) |
| Project board | [Adventure (project #3)](https://github.com/users/betsalel-williamson/projects/3) — filter Program = Cloud deploy MVP |
| Milestone | [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1) |
| Issue templates | [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/config.yml) |
| Project guide | [work-registry/github-project.md](work-registry/github-project.md) |
| Work registry | [work-registry/index.md](work-registry/index.md) |

Branch pattern: `cloud-deploy/<work-key>-<slug>`. PRs: `Closes #N` · `Part of #3`. Set **`WORK_ITEM=#N`** in agent prompts.

## mdcp task prompts

After `npm run docs:fetch`, load task-type prompts from `.caches/mdcp/prompts/`:

- `feature-level-task.prompt.md`
- `doc-only-task.prompt.md`
- `design-architecture-task.prompt.md`
- `ux-task.prompt.md`
- `review-task.prompt.md`

Fill the **Replace before sending** block at the top of each prompt before use.
