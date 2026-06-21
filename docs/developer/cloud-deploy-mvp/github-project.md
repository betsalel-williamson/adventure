# Cloud deploy MVP — GitHub Project management

How to run epic [#3](https://github.com/betsalel-williamson/adventure/issues/3) using GitHub Issues, Milestones, and project #3.

**Canonical project doc:** [work registry — GitHub Project](../work-registry/github-project.md) (fields, views, sync, rate limits).

**TDD workflow:** [TDD + GitHub workflow](../tdd-and-github-workflow.md) · **Issue triage:** [issue-triage.md](../work-registry/issue-triage.md)

## Tracking stack

| Layer | Purpose | Link |
| --- | --- | --- |
| **Epic + sub-issues** | Scope, dependencies, acceptance criteria | [#3](https://github.com/betsalel-williamson/adventure/issues/3) (children #4–#14) |
| **Work graph** | DAG keys (D0, I1, …), doc links | [work-graph.md](../../architecture/cloud-deploy-mvp/work-graph.md) |
| **Milestone** | Release slice / filter | [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1) |
| **GitHub Project** | Board / table / priority | [Adventure (project #3)](../work-registry/github-project.md) — filter **Program = Cloud deploy MVP** |

## Milestone (configured)

All cloud-deploy issues (#3–#14) belong to milestone **[Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1)**.

Use the milestone on the [Issues](https://github.com/betsalel-williamson/adventure/issues?q=is%3Aissue+milestone%3A%22Cloud+deploy+MVP%22) tab to see progress toward MVP acceptance ([mvp-scope.md](../../architecture/cloud-deploy-mvp/mvp-scope.md)).

## GitHub Project

**Live board:** [Adventure — project #3](https://github.com/users/betsalel-williamson/projects/3) (filter **Program → Cloud deploy MVP**)

Field setup, recommended views, and sync CLI: [work registry — GitHub Project](../work-registry/github-project.md).

Cloud-only sync:

```bash
gh auth refresh -h github.com -s project,read:project
./scripts/setup-cloud-deploy-project.sh --resume --auto-wait
```

## Workflow conventions

### Branch naming

```text
cloud-deploy/<work-key>-<short-slug>
```

Examples: `cloud-deploy/i1-inference-openapi`, `cloud-deploy/c1-container-image`.

Set `WORK_ITEM=#5` (or issue URL) in agent prompts — see [agent work-item tracking](../agent-work-item-tracking.md) and [TDD + GitHub workflow](../tdd-and-github-workflow.md).

### Pull requests

- **One issue per PR** when possible (small batch).
- **Base branch:** `feature/adventure-llm` ([branch policy](../branch-policy.md))
- **Title:** `cloud-deploy (I1): unified inference OpenAPI` (work key + short slug)
- **Body:** [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) — canonical template; GitHub pre-populates it on new PRs. Use **Closes #N** only when acceptance criteria are fully met.

### Status updates

| When | Action |
| --- | --- |
| Start work | Assign yourself; Project **Status** → In progress |
| Blocked | Comment with blocked-by issue; **Status** → Blocked |
| PR open | Link PR in issue comment |
| Merged + verified | Close issue; **Status** → Done |
| Epic progress | Review [#3](https://github.com/betsalel-williamson/adventure/issues/3) sub-issue checklist |

### Execution order (from work graph)

1. **Foundation (parallel):** #5 I1, #6 S1, #7 C1
2. **Deploy shell:** #8 C2
3. **Relay + desktop:** #9 I4, #10 I5
4. **Integration:** #11 I6, #12 I7, #13 I8
5. **Smoke:** #14 E1

Do not start an issue until **Blocked by** issues are closed (or explicitly waived in a comment on the epic).

### New tasks

Use **New issue → Cloud deploy MVP — task** (not blank issues). Epic: **#3**. Add to milestone **Cloud deploy MVP**. Sub-issue link: add under epic #3 in GitHub UI or `gh api graphql` `addSubIssue`.

## Automation (optional)

After the project exists, you can add a workflow that auto-adds labeled issues to the project using [actions/add-to-project](https://github.com/actions/add-to-project). Requires a `PROJECT_URL` repository variable and a token with `project` scope — see script output for URL.

## Related

- [Maintainer index](./index.md)
- [TDD + GitHub workflow](../tdd-and-github-workflow.md)
- [Issue triage](../work-registry/issue-triage.md)
- [Work registry GitHub Project](../work-registry/github-project.md)
- [Issue templates archive](../../architecture/cloud-deploy-mvp/github-issues.md)
- [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)
