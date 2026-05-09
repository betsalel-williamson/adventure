# Adventure V2 Task Plan

## Objective

Produce implementation-ready v2 documentation and scaffold definition for a new `adventure-v2` monorepo project, with requirement traceability from user story through architecture and stepwise tasks.

## Implementation status

Code and tests now live under [`adventure-v2/`](../../adventure-v2/). **Authoritative loop state** (which slice is active, finished, or next) is in the planning index [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot). Product and engineering detail for the current HTTP surface, tests, and backlog: [`adventure-v2/README.md`](../../adventure-v2/README.md).

**Slice 12 (configurable CORS):** optional comma-separated **`ADV_V2_CORS_ORIGINS`** env var on the server; unset preserves **`Access-Control-Allow-Origin: *`**. Covered in [`tests/http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts) and documented in README slice bullets + **`design.md`** §3.1. Close-out: [`slice-12-multidisciplinary-review.md`](slice-12-multidisciplinary-review.md).

**Slice 13 (LangGraph + XState + trace observability):** pre-oracle **LangGraph** turn path, **`xstate`** control machine, extended **`CognitionTraceWire`**, async **`processTurn`**, **10** SSE events per turn. Close-out: [`slice-13-multidisciplinary-review.md`](slice-13-multidisciplinary-review.md); plan archive: [`adventure-v2-slice-13-langgraph-xstate.plan.md`](adventure-v2-slice-13-langgraph-xstate.plan.md).

**Slice 14 (MVP shell — interactive UI, full plan prompts, stub autoplay):** [`apps/web`](../../adventure-v2/apps/web) command input + multi-turn **`POST /turns`**; **`promptSystem`** / **`promptUser`** on **`plan`** trace wire with truncation; browser **stub autoplay** loop (`stubAutoplayPlanner`) and replay-demo button (no auto-replay on load). HTTP coverage for two sequential turns; Vitest for `shellState`, `stubAutoplayPlanner`, `capPromptTextForWire`, **wireDisplay** panels. Close-out: [`slice-14-multidisciplinary-review.md`](slice-14-multidisciplinary-review.md).

**Slice 15 (virtual terminal lane):** Pure helpers in [`wireDisplay.ts`](../../adventure-v2/apps/web/src/wireDisplay.ts) (`formatVirtualTerminalUserEcho`, `formatVirtualTerminalTurnChunk`, `formatVirtualTerminalWireChunk`); **game terminal** UI + optional raw SSE toggle; README Fortran/MVP-gap subsection. Close-out: [`slice-15-multidisciplinary-review.md`](slice-15-multidisciplinary-review.md).

**Slice 16 (CRT shell + agent diagrams + cognition log):** CRT styling on **game terminal**; **`appendCognitionTraceEntry`** + cap; Mermaid (**`codegen:brain-mermaid`**, **`agentDiagrams.ts`**); stub autoplay **10** moves; docs + close-out [`slice-16-multidisciplinary-review.md`](slice-16-multidisciplinary-review.md).

**Slice 17 (web shell modularity + UX U3–U5):** Split **`agentDiagramPanel`**, **`gameTerminalBuffer`**, **`runCheckpointsApi`**, **`shellUiPreferences`** out of **`main.ts`**; oracle-mode intro copy + stub autoplay tooltip; raw SSE toggle persisted (default off); game terminal placeholder until first **`oracle_observation`**. Plan: [`adventure-v2-slice-17-web-shell-modularity-ux.plan.md`](adventure-v2-slice-17-web-shell-modularity-ux.plan.md); close-out: [`slice-17-multidisciplinary-review.md`](slice-17-multidisciplinary-review.md).

**Slice 18 (game terminal — oracle empty line):** **`gameTerminalTurnAppendFromWire`** maps SSE turns to CRT appends with **`vtChunk !== null`** semantics so whitespace-only **`oracle_observation.output`** still clears the wait banner; **`main.ts`** uses the helper. Close-out: [`slice-18-multidisciplinary-review.md`](slice-18-multidisciplinary-review.md).

**UX multidisciplinary review (end-user lens):** prep artifacts, demo matrix, and **incremental work-queue steps U0–U7** — [`ux-multidisciplinary-review-prep.md`](ux-multidisciplinary-review-prep.md) (§5 registers with [plan queue index](../planning/plan-queues-index.md)).

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
