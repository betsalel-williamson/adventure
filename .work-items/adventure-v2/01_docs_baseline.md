# 01 Docs baseline

## Objective

Create baseline v2 work-item and architecture documents with requirement traceability (R1-R5).

## Acceptance criteria

- `user-story.md`, `design.md`, and `task.md` exist under `.work-items/adventure-v2/`.
- `docs/architecture/adventure-v2/` includes overview, logical, process, data, and security/ops docs.
- `docs/architecture/overview.md` links to the v2 overview.
- Each document states oracle truth boundary and drift/reconcile expectations.

## Requirements

- R1, R2, R3, R4, R5

## Test strategy

- Verify file existence and path references.
- Confirm R1-R5 appear at least once in work-item docs.
- Review architecture docs for explicit oracle-vs-inferred-state language.
