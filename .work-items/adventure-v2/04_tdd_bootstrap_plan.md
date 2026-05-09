# 04 TDD bootstrap plan

## Objective

Define the first implementation slices using Red-Green-Refactor sequencing with a Cucumber-style BDD outer loop.

## Acceptance criteria

- Initial slices are documented in this order:
  1. Feature files for R1-R5 scenarios (red).
  2. Failing step-definition assertions for contract boundaries (red).
  3. Minimal contract exports and parsing paths (green).
  4. Reconcile parser/classifier tests and steps (red).
  5. Minimal reconcile implementation (green).
  6. Control machine transition tests and steps (red).
  7. Minimal XState machine implementation (green).
  8. End-to-end synthetic run fixture with checkpoints (red/green).
- Each slice identifies expected assertions and artifacts.

## Requirements

- R2, R3, R4, R5

## Test strategy

- Organize acceptance tests in `features/` grouped by requirement (`r1_model_swap.feature`, etc.).
- Use scenario outlines for model/provider matrix coverage without duplicating narrative cases.
- Keep step definitions deterministic and side-effect scoped; avoid shared mutable globals across scenarios.
- Ensure every planned implementation step begins with failing tests.
- Ensure refactor opportunities are called out only after green.
- Confirm no slice merges unrelated structural and behavioral changes.
