---
name: ""
overview: ""
todos: []
isProject: false
---

# adventure-llm — work item

## Objective

Specs-first decomposition, TDD harness (unit → integration → E2E), then a TypeScript engine that reads unchanged `adventure.dat` plus an NL layer (Gemini structured output) and optional imagery—preserving classic Colossal Cave behavior, including documented Fortran-oracle parity (bug fixes deferred to a future initiative).

## Related plans

- **Implementation plan (canonical copy in this repo):** [adventure-llm_specs_tdd_4d7c2af8.plan.md](./adventure-llm_specs_tdd_4d7c2af8.plan.md)

### Cursor `plans/` symlink (optional)

The `.cursor` directory is a **git submodule** (`genai-specs`), so the task symlink is not committed in the adventure repo. To mirror Cursor’s active-work convention locally, from the repo root:

```sh
cd .cursor/plans && ln -sf ../../.work-items/adventure-llm/task.md adventure-llm-task.plan.md
```

That makes `.cursor/plans/adventure-llm-task.plan.md` point at this file. Duplicate or move the implementation plan in the submodule if you want it only under `.cursor/plans/`; the tracked copy lives beside this `task.md`.

## Branch

`feature/adventure-llm`

## Deliverables (see plan)


| Artifact                                | Status  |
| --------------------------------------- | ------- |
| `user-story.md`                         | Pending |
| `design.md`                             | Pending |
| `bugs.md`                               | Pending |
| `docs/architecture/adventure-engine.md` | Pending |
| Numbered step files (`01_*.md`, …)      | Pending |
| `adventure-llm/` TypeScript package     | Pending |


## Task steps

Numbered ACID step files will be added under this directory as work progresses (see plan Phase 1–5).