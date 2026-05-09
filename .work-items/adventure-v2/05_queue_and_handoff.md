# 05 Queue and handoff

## Objective

Prepare planning queues and implementation kickoff criteria for adventure-v2.

## Planning index (repo)

Lifecycle queues and Cursor plan inventory: [`.work-items/planning/plan-queues-index.md`](../planning/plan-queues-index.md).

**Always know loop state:** that file’s [**Current development loop snapshot**](../planning/plan-queues-index.md#current-development-loop-snapshot) plus **Awaiting commit / HIL gate** (green work waiting on human commit) and [**State vocabulary**](../planning/plan-queues-index.md#state-vocabulary-development-loop) (`Implementing`, `AwaitingHILCommit`, `BetweenPlans`, `Blocked`, …).

**Adventure v2** historical plans: [slice 2 — HTTP/SSE](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md); [slice 1 — minimal milestones](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md) (M1–M8 **complete**). **Slice 4 (retrospective):** process oracle bridge is implemented in-tree — [`adventure-v2/apps/server/src/oracle/processOracleBridge.ts`](../../adventure-v2/apps/server/src/oracle/processOracleBridge.ts), [`oracle-subprocess-ipc.md`](../../docs/architecture/adventure-v2/oracle-subprocess-ipc.md), tests under `adventure-v2/tests/`. **Active slice** is tracked in the planning index snapshot (currently **slice 5 — R4 web observability**: [`.cursor/plans/adventure-v2-slice-5-r4-web-observability.plan.md`](../../.cursor/plans/adventure-v2-slice-5-r4-web-observability.plan.md)).

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

## Kickoff checklist

- [ ] Contract schema review approved (`packages/contracts` ownership confirmed).
- [ ] Cucumber-style acceptance feature scope agreed for R1-R5.
- [ ] Replay/checkpoint and reconcile/drift telemetry fields finalized.
  - [ ] Control-loop transition policy (`act`, `think`, `test`, `chaos`, `disorder`) approved.
- [ ] Implementation order approved for first TDD slices.

## Dependencies and open risks

### Dependencies

- Final package manager/workspace decision for `adventure-v2`.
- External oracle process interface contract and fixture policy.
- Agreement on acceptance-test runner stack for Cucumber-style workflow.

### Open risks

- Drift attribution can be ambiguous without strict event IDs across layers.
- Replay fidelity can degrade if checkpoint payload omits control-phase state.
- Scenario explosion risk for model/provider matrix without disciplined outlines.
