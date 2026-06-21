# Work registry

Machine-readable catalog of trackable work, migrated from legacy [`.work-items/`](../../../.work-items/) into GitHub Issues and a single GitHub Project.

## Components

| Artifact | Path | Role |
| --- | --- | --- |
| **Manifest** | [`scripts/work-registry/manifest.json`](../../../scripts/work-registry/manifest.json) | Programs, work keys, phases, source paths, pre-seeded issue numbers |
| **Ledger** | `.caches/work-registry-ledger.json` (gitignored) | Resume state: `issue`, `projectItemId`, `syncStatus`, `_meta.projectSetup`, `_link::*` |
| **GraphQL helpers** | [`scripts/lib/gh-graphql.sh`](../../../scripts/lib/gh-graphql.sh) | Rate-limit check, throttle, wait-until-reset, wait-or-quit, retry |

## Programs

| Program ID | Label | Source |
| --- | --- | --- |
| `cloud-deploy-mvp` | Cloud deploy MVP | Docs work graph (issues #3–#14) |
| `adventure-v3` | Adventure v3 | `.work-items/adventure-langgraph/` |
| `adventure-webclient` | Webclient | `.work-items/adventure-webclient/` |
| `nl-backend-nl-deprecation` | NL deprecation | `.work-items/nl-backend-nl-deprecation/` |
| `agent-project-authoring` | Agent authoring | `.work-items/agent-project-authoring/` |
| `adventure-v2` | v2 maintenance | `.work-items/adventure-v2/` (U0–U7) |
| `adventure-nl` | Archive | `.work-items/adventure-nl/` (closed issues) |

## Commands

From repo root. Requires `gh` with `project` scope:

```bash
gh auth refresh -h github.com -s project,read:project
```

### 1. Extract / refresh manifest from `.work-items/`

```bash
node scripts/work-registry/extract-from-work-items.mjs --merge --write
```

Merge mode preserves seeded issue numbers and ledger entries.

### 2. Create GitHub issues (idempotent)

```bash
./scripts/work-registry/migrate-to-github.sh --resume
```

Options:

- `--program <id>` — limit to one program (e.g. `adventure-v3`)
- `--dry-run` — print planned actions only
- `--no-resume` — attempt all creates (still skips items with ledger `issue`)
- `--auto-wait` — sleep until rate-limit reset and continue (unattended)
- `--quit-on-rate-limit` — exit with local resume timestamp (default when not a TTY)

Creates issues with labels `program:<id>` and `work-key:<key>`. Links sub-issues under program epics. Closes items with `status: done` (archive).

**Rate limits:** REST issue creates batched (5 per batch, 30s pause). GraphQL sub-issue links use [`gh_retry`](../../../scripts/lib/gh-graphql.sh).

### 3. Sync GitHub Project

```bash
./scripts/work-registry/sync-github-project.sh --resume
```

Ensures project **Adventure** ([project #3](https://github.com/users/betsalel-williamson/projects/3)) has fields **Program**, **Work key**, **Phase**, **Status**, adds all ledger issues, sets field values.

Supports the same `--auto-wait` and `--quit-on-rate-limit` flags as migrate.

Backward-compatible wrapper for cloud deploy only:

```bash
./scripts/setup-cloud-deploy-project.sh --resume --auto-wait
```

### 4. Verify

```bash
./scripts/work-registry/verify.sh
```

Checks ledger completeness, issue existence, project membership, cloud deploy #3–#14.

## Migration waves

Run extract before each wave. Pause between waves if GraphQL quota is low (`gh api rate_limit --jq '.resources.graphql'`).

| Wave | Program filter | Action |
| --- | --- | --- |
| 1 | `cloud-deploy-mvp` | Sync only (#3–#14 exist) |
| 2 | `adventure-v3`, `adventure-webclient`, `nl-backend-nl-deprecation` | Create + sync open work |
| 3 | `agent-project-authoring` | Create + sync |
| 4 | `adventure-v2` | Create + sync (U6–U7 open) |
| 5 | `adventure-nl` | Create closed archive + sync |

Example wave:

```bash
node scripts/work-registry/extract-from-work-items.mjs --merge --write
./scripts/work-registry/migrate-to-github.sh --resume --program adventure-v3
./scripts/work-registry/sync-github-project.sh --resume --program adventure-v3
./scripts/work-registry/verify.sh
```

## Rate limits and resume

### ACID resume model

Each script writes to the ledger **only after** a unit of work succeeds on GitHub:

| Step | Ledger key | Committed when |
| --- | --- | --- |
| Issue create | `program::workKey` | Issue URL returned |
| Sub-issue link | `_link::program::parent::child` | Link mutation succeeds (or assumed existing) |
| Project field setup | `_meta.projectSetup` | All custom fields exist |
| Project item sync | `program::workKey.syncStatus` | Item on board + all four field values set |

If a run stops (rate limit, Ctrl+C, error), re-run the **same command with `--resume`**. Completed ledger entries are skipped; partial items are retried idempotently.

### Throttling and rate-limit policy

- Default **2s** delay between GraphQL mutations (`GH_SYNC_DELAY_SEC`).
- Default **0.5s** between reads (`GH_SYNC_READ_DELAY_SEC`).
- When quota is low, scripts wait until reset (prints **local time**).
- When quota is exhausted after retries:
  - **Interactive TTY (default):** prompt to wait until reset or quit
  - **`--auto-wait`:** sleep until reset and continue
  - **`--quit-on-rate-limit`:** exit code `42` with resume timestamp; re-run with `--resume` later

```bash
# Unattended migration — waits through rate limits automatically
./scripts/work-registry/sync-github-project.sh --resume --auto-wait

# Interactive — asks whether to wait or quit
./scripts/work-registry/sync-github-project.sh --resume

# CI / scripted — quit with timestamp instead of blocking
./scripts/work-registry/sync-github-project.sh --resume --quit-on-rate-limit
```

Check quota:

```bash
gh api rate_limit --jq '.resources.graphql'
```

If `gh` reports rate limits but `gh api rate_limit` shows quota available, clear stale cache ([cli#12812](https://github.com/cli/cli/issues/12812)):

```bash
grep -rl 'X-Ratelimit-Remaining: 0' ~/.cache/gh/ 2>/dev/null | xargs rm -f
```

## Project board

See [GitHub Project management](github-project.md).

## Related

- [Agent work-item tracking](../agent-work-item-tracking.md)
- [Cloud deploy work graph](../../architecture/cloud-deploy-mvp/work-graph.md)
