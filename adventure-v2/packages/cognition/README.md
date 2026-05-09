# adventure-v2 cognition package (planned)

## Responsibility

- Implement LangGraph-based orchestration nodes.
- Produce `ActionProposal`, consume `OracleObservation`.
- Produce `ReconcileOutcome` and checkpoint-bound cognition state.

## Initial scaffold targets

- `src/graph/` node and edge definitions.
- `src/reconcile/` belief update and drift classification logic.
- `src/checkpoints/` checkpoint integration adapter.
