# 05 Queue and handoff

## Objective

Prepare planning queues and implementation kickoff criteria for adventure-v2.

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
