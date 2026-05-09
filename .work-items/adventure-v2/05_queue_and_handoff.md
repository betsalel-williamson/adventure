# 05 Queue and handoff

## Objective

Prepare planning queues and implementation kickoff criteria for adventure-v2.

## Planning index (repo)

Lifecycle queues and Cursor plan inventory: [`.work-items/planning/plan-queues-index.md`](../planning/plan-queues-index.md).

**Always know loop state:** that file’s [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot) plus **Awaiting commit / HIL gate** (green work waiting on human commit) and [**State vocabulary**](../planning/plan-queues-index.md#state-vocabulary-development-loop) (`Implementing`, `AwaitingHILCommit`, `BetweenPlans`, `Blocked`, …).

**Adventure v2 — where things live:** **only** the planning index [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot) states whether work is between plans, implementing a slice, or blocked. Do not infer slice status from this file alone.

**Historical / finished plan pointers (examples):** [slice 1 — minimal milestones](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md) (M1–M8); [slice 2 — HTTP/SSE](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md); [slice 5 — R4 web observability](../../.cursor/plans/adventure-v2-slice-5-r4-web-observability.plan.md); [slice 6 — cognition trace](adventure-v2-slice-6-r4-cognition-trace.plan.md). Retrospective implementation anchors: process oracle [`processOracleBridge.ts`](../../adventure-v2/apps/server/src/oracle/processOracleBridge.ts), [`oracle-subprocess-ipc.md`](../../docs/architecture/adventure-v2/oracle-subprocess-ipc.md), tests under `adventure-v2/tests/`. Current behavior and backlog: [`adventure-v2/README.md`](../../adventure-v2/README.md).

## Acceptance criteria

- Planning index includes adventure-v2 in appropriate queue.
- Kickoff checklist exists for moving from docs/scaffold to implementation.
- Dependencies and open risks are explicitly listed.

## Requirements

- R1, R2, R3, R4, R5

## Test strategy

- Confirm queue entry appears once and in correct status.
- Confirm kickoff checklist includes:
  - contract review signoff,
  - replay/drift telemetry acceptance,
  - package ownership confirmation.

## Kickoff checklist (original scaffold phase)

Completed outcomes are preserved above for audit; ongoing engineering uses the **Post-scaffold checklist** below.

- [x] Contract schema review approved (`packages/contracts` ownership confirmed).
- [x] Acceptance coverage for R1–R5 agreed (Vitest + HTTP acceptance; Gherkin files as behavioral reference; optional Cucumber deferred per README).
- [x] Replay/checkpoint and reconcile/drift telemetry fields initially finalized on wire (incremental richness per README).
  - [x] Control-loop transition policy (`act`, `think`, `test`, `chaos`, `disorder`) documented in architecture.
- [x] Implementation order for early TDD slices executed (see Finished queue in planning index).

## Post-scaffold / ongoing engineering checklist

Use when opening a new slice or PR:

- [ ] Confirm [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot) and [`adventure-v2/README.md`](../../adventure-v2/README.md) agree on scope (“not yet”, optional Cucumber, CI splits).
- [ ] Run `cd adventure-v2 && npm test` (and opt-in Fortran oracle script per README when touching oracle bridge).
- [ ] Update the planning index snapshot when slice status changes.

## Dependencies and open risks

### Dependencies

- `adventure-v2` workspace layout and tooling are established; prefer incremental changes over broad rewrites.
- External oracle process interface: see [`oracle-subprocess-ipc.md`](../../docs/architecture/adventure-v2/oracle-subprocess-ipc.md) and Fortran CI workflow when extending bridges.
- Optional `@cucumber/cucumber` runner remains a follow-on; Vitest is the CI gate today.

### Open risks

- Drift attribution can be ambiguous without strict event IDs across layers.
- Replay fidelity can degrade if checkpoint payload omits control-phase state.
- Contracts today collapse several oracle subprocess outcomes into **`rejected`**; distinguishing **`oracle_halted`** (or equivalent) from recoverable rejection would clarify terminal runs versus retry loops.
- Benchmark claims of **bit-perfect replay** across oracle/binary restart are weaker than replay inside one long-lived oracle: engine RNG re-seeds on process spawn (see [`data-view.md`](../../docs/architecture/adventure-v2/data-view.md) **Replay vs oracle respawn**).
- Scenario explosion risk for model/provider matrix without disciplined outlines.
