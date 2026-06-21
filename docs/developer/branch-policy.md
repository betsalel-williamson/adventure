# Branch policy

This repository uses **two Git branches with different roles**. Do not treat `main` as the default development or PR base branch.

## Branches

| Branch | Role | Who changes it |
| --- | --- | --- |
| **`main`** | **Frozen historical source** — original Colossal Cave Adventure Fortran lineage preserved for clean-room comparison against upstream forks | Do not commit product work here |
| **`feature/adventure-llm`** | **Default development branch** (GitHub default) — TypeScript tooling, docs, cloud deploy MVP, CI | All contributors and agents |

## Why `main` stays frozen

We keep `main` aligned with the authentic historical game source so we can:

- Compare against the upstream fork without drift from product layers
- Demonstrate that the Fortran oracle and `adventure.dat` mechanics remain faithful to the original lineage
- Separate **“is the game authentic?”** from **“what did we build on top?”**

All application work (NL stack, v2, langgraph, webclient, cloud deploy, docs shards) lives on **`feature/adventure-llm`** and topic branches cut from it.

## Workflow conventions

```bash
git fetch origin
git checkout feature/adventure-llm
git pull origin feature/adventure-llm
git checkout -b cloud-deploy/i1-inference-openapi   # or your topic branch
```

- **Pull requests** target **`feature/adventure-llm`** — fill [`.github/pull_request_template.md`](../../.github/pull_request_template.md) (GitHub pre-populates it on new PRs).
- **CI** merges the repository default branch into PR heads (see [`.github/workflows/adventure.yml`](../../.github/workflows/adventure.yml)).
- **Merges are blocked** until the **`ci`** job passes (branch protection on `feature/adventure-llm`). The `ci` job aggregates all package tests, docs-check, changeset-check (PRs only), and cloud-deploy-c1.
- **Doc links** in issues and scripts use `blob/feature/adventure-llm/…`, not `blob/main/…`.

## Branch protection

`feature/adventure-llm` requires:

| Rule | Setting |
| --- | --- |
| Required status check | **`adventure / ci`** |
| Require branches up to date | Yes (`strict`) |
| Require pull request | Yes |
| Force pushes | Disabled |

Direct pushes to the default branch still run CI on `push`, but PR merges must show green **`ci`** before GitHub enables the merge button.

## Agents

Set branch discipline in prompts:

- Branch from updated **`feature/adventure-llm`**
- **`WORK_ITEM=#N`** for scope
- PR base: **`feature/adventure-llm`**

See [agent work-item tracking](agent-work-item-tracking.md) and [TDD + GitHub workflow](tdd-and-github-workflow.md).

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [Repository layout](repo-layout.md)
