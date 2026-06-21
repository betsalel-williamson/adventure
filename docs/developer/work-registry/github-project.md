# GitHub Project — Adventure

Single project board for all programs migrated from the work registry.

**Live board:** [Adventure (project #3)](https://github.com/users/betsalel-williamson/projects/3)

## Fields

| Field | Purpose | Examples |
| --- | --- | --- |
| **Program** | Initiative / track | Cloud deploy MVP, Adventure v3, Webclient, Archive |
| **Work key** | Stable ID within program | EPIC, US-5-1, Phase-1, D0 |
| **Phase** | Execution grouping | Foundation, Deploy, Implementation, Done, Archive |
| **Status** | Board column | Todo, In progress, Blocked, Done |

## Recommended views

Create in the GitHub UI after sync:

| View | Layout | Group / filter |
| --- | --- | --- |
| **Board** | Board | Status |
| **By program** | Table | Filter Program |
| **Cloud deploy** | Table | Program = Cloud deploy MVP; sort Work key |
| **Active** | Table | Program = Cloud deploy MVP; Status ≠ Done — see [issue triage](../issue-triage.md#mvp-filter-active-view) |
| **Active (all programs)** | Table | Status ≠ Done; Program ≠ Archive |

## Sync from CLI

Full registry sync (all programs):

```bash
./scripts/work-registry/sync-github-project.sh --resume
```

Cloud deploy only (legacy entry point):

```bash
./scripts/setup-cloud-deploy-project.sh
```

Setup requires project scope:

```bash
gh auth refresh -h github.com -s project,read:project
```

## Rate limits

The sync script caches field and item lists, batches issue node ID lookups, throttles mutations, and records progress in the ledger after each item. Expect **~5–15 minutes** for a full 60-item sync.

If sync fails mid-run (rate limit, interrupt, error):

```bash
./scripts/work-registry/sync-github-project.sh --resume
```

Unattended — wait through rate limits automatically:

```bash
./scripts/work-registry/sync-github-project.sh --resume --auto-wait
```

When quota is exhausted, the script prints the **local resume timestamp**. Choose to wait interactively, pass `--auto-wait`, or quit and re-run later (exit code `42` with `--quit-on-rate-limit`).

Details: [work registry index](index.md#rate-limits-and-resume).

## Cloud deploy MVP

Issues #3–#14 remain the cloud deploy work graph. Filter the board by **Program → Cloud deploy MVP** or use milestone [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1).

Work graph: [work-graph.md](../../architecture/cloud-deploy-mvp/work-graph.md).

## Related

- [Work registry index](index.md)
- [Issue triage catalog](issue-triage.md)
- [TDD + GitHub workflow](../tdd-and-github-workflow.md)
- [Agent work-item tracking](../agent-work-item-tracking.md)
