# 02 Contracts and loops

## Objective

Define runtime contracts and actor ownership boundaries across server, LangGraph cognition, and XState control.

## Acceptance criteria

- Contract definitions exist for turn envelope, reconcile outcome, and checkpoint reference.
- Ownership is explicit for:
  - LangGraph cognition responsibilities,
  - XState control-loop responsibilities,
  - server sequencing/oracle responsibilities.
- Loop policy (`act`, `think`, `test`, `chaos`, `disorder`) includes transition and recovery guidance.
- Runtime behavior is documented as actor/flow descriptions in `docs/architecture/adventure-v2/process-view.md`:
  - actor inventory naming each owning package,
  - actor-attributed turn flow (lanes per actor),
  - sequence diagrams for nominal turn, drift/reconcile, invalid action recovery, replay, and session lifecycle,
  - producer/consumer matrix in `contracts-and-actors.md` cross-referenced from each flow.

## Requirements

- R2, R3, R4, R5

## Test strategy

- Validate contracts are finite/discriminated and implementation-friendly.
- Ensure replay requires both checkpoint and control-phase restoration.
- Ensure drift classes are enumerable for benchmark aggregation.
- Verify each documented contract appears with exactly one producer in the
  process-view producer/consumer matrix.
- Verify each scenario flow names a producing actor, a consuming actor, and a
  contract on every message arrow.
