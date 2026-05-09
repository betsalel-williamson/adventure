# Adventure V2 Task Plan

## Objective

Produce implementation-ready v2 documentation and scaffold definition for a new `adventure-v2` monorepo project, with requirement traceability from user story through architecture and stepwise tasks.

## Implementation status

Code and tests now live under [`adventure-v2/`](../../adventure-v2/). **Authoritative loop state** (which slice is active, finished, or next) is in the planning index [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot). Product and engineering detail for the current HTTP surface, tests, and backlog: [`adventure-v2/README.md`](../../adventure-v2/README.md).

## Requirements traceability

- **R1** Model swap benchmark execution across `SLM`, `LLM`, `API`, and `MLX` categories.
- **R2** Deterministic checkpoint and replay support.
- **R3** Drift-aware reconcile loop against external truth.
- **R4** Console-first UX with XState/LangGraph observability.
- **R5** Invalid-action recovery and telemetry.

## Acceptance criteria

- Work-item docs exist for v2 (`user-story.md`, `design.md`, `task.md`) and reference R1-R5.
- New architecture package exists under `docs/architecture/adventure-v2/` with logical/process/data/security views.
- Root architecture index references the new v2 architecture overview.
- Contracts and control-loop ownership are documented clearly enough to guide implementation.
- Sequential task files (`01_*.md` and onward) are present and independently testable.

## Test strategy

- Documentation integrity checks:
  - Each required file exists in expected location.
  - Internal references are valid relative paths.
- Cucumber-style TDD checks:
  - Define Gherkin scenarios for each requirement (R1-R5) before implementation.
  - Map each scenario to step definitions and explicit assertion targets (contracts, loop transitions, replay artifacts).
  - Keep scenario language user-observable (avoid implementation details in feature text).
- Consistency checks:
  - Requirement IDs R1-R5 appear in user-story, design, and task/step files.
  - Architecture docs state the external oracle truth boundary and reconcile behavior.
  - v2 docs consistently enumerate model categories as `SLM`, `LLM`, `API`, and `MLX`.
- Readability checks:
  - Process and loop docs include ordered flow and failure/recovery paths.

## Task sequencing

- `01_docs_baseline.md`: create PRD/work-item and architecture baseline files.
- `02_contracts_and_loops.md`: define event, reconcile, checkpoint schemas and loop ownership.
- `03_scaffold_map.md`: define package layout and boundaries.
- `04_tdd_bootstrap_plan.md`: define Cucumber-style acceptance scenarios plus red/green/refactor implementation slices.
- `05_queue_and_handoff.md`: update planning queues and implementation kickoff checklist.
