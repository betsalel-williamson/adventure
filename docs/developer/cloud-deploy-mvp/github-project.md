# Cloud deploy MVP — GitHub Project management

How to run epic [#3](https://github.com/betsalel-williamson/adventure/issues/3) using GitHub Issues, Milestones, and Projects (best practices for this repo).

## Tracking stack

| Layer | Purpose | Link |
| --- | --- | --- |
| **Epic + sub-issues** | Scope, dependencies, acceptance criteria | [#3](https://github.com/betsalel-williamson/adventure/issues/3) (children #4–#14) |
| **Work graph** | DAG keys (D0, I1, …), doc links | [work-graph.md](../../architecture/cloud-deploy-mvp/work-graph.md) |
| **Milestone** | Release slice / filter | [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1) |
| **Labels** | `cloud-deploy-mvp`, `epic` | Issue list filter |
| **GitHub Project** | Board / table / priority | [Adventure (project #3)](../work-registry/github-project.md) — filter **Program = Cloud deploy MVP** |
| **Issue templates** | Consistent new tasks | [`.github/ISSUE_TEMPLATE/`](../../../.github/ISSUE_TEMPLATE/config.yml) |

## Milestone (configured)

All cloud-deploy issues (#3–#14) belong to milestone **[Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1)**.

Use the milestone on the [Issues](https://github.com/betsalel-williamson/adventure/issues?q=is%3Aissue+milestone%3A%22Cloud+deploy+MVP%22) tab to see progress toward MVP acceptance ([mvp-scope.md](../../architecture/cloud-deploy-mvp/mvp-scope.md)).

## GitHub Project

**Live board:** [Adventure — project #3](https://github.com/users/betsalel-williamson/projects/3) (filter **Program → Cloud deploy MVP**)

The project is shared across all programs; see [work registry](../work-registry/index.md). Cloud deploy items use **Work key**, **Phase**, and **Status** fields plus **Program = Cloud deploy MVP**.

If fields or issues are missing on the board, use **Option A** or **Option B** below.

### Option A — Adjust in GitHub UI

1. Open [project #3](https://github.com/users/betsalel-williamson/projects/3) (or [adventure → Projects](https://github.com/betsalel-williamson/adventure/projects)).
2. **Add items** if needed → issues **#3–#14** (filter `label:cloud-deploy-mvp`).
3. **Customize fields** (project **⋯** → **Settings** → **Fields**):
   - **Work key** (single select): `EPIC`, `D0`, `I1`, `S1`, `C1`, `C2`, `I4`, `I5`, `I6`, `I7`, `I8`, `E1`
   - **Phase** (single select): `Foundation`, `Deploy`, `Relay`, `Integration`, `Done`
   - **Status** (single select): `Todo`, `In progress`, `Blocked`, `Done`
4. Set **D0 (#4)** → Status **Done**, Phase **Done**; epic **#3** → Work key **EPIC**; rest → **Todo** and phases from [work graph](../../architecture/cloud-deploy-mvp/work-graph.md).
5. Add views: **Board** grouped by Status; **Table** sorted by Work key.

### Option B — CLI (work registry sync)

See [work registry](../work-registry/index.md) for full migration docs. Cloud deploy only:

```bash
gh auth refresh -h github.com -s project,read:project
./scripts/setup-cloud-deploy-project.sh
```

The script syncs issues #3–#14 via [`sync-github-project.sh`](../../../scripts/work-registry/sync-github-project.sh) with GraphQL rate-limit handling and resume support.

After setup, add these views in the project:

| View | Layout | Group / sort |
| --- | --- | --- |
| **Board** | Board | Status → Todo / In progress / Done / Blocked |
| **Work graph** | Table | Sort by Work key (D0 → E1) |
| **Phase** | Board | Phase → Foundation / Deploy / Relay / Integration |
| **Ready** | Table | Filter Status = Todo and no blocked-by open issues (manual) |

## Workflow conventions

### Branch naming

```text
cloud-deploy/<work-key>-<short-slug>
```

Examples: `cloud-deploy/i1-inference-openapi`, `cloud-deploy/c1-container-image`.

Set `WORK_ITEM=#5` (or issue URL) in agent prompts — see [agent work-item tracking](../agent-work-item-tracking.md).

### Pull requests

- **One issue per PR** when possible (small batch).
- Title: `cloud-deploy (I1): unified inference OpenAPI`
- Body:

```markdown
## Summary
…

## Work item
Closes #5
Part of #3

## Test plan
- [ ] …
```

Use **Closes #N** only when acceptance criteria are fully met (task standards).

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
- [Issue templates archive](../../architecture/cloud-deploy-mvp/github-issues.md)
- [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)
