# 03 Scaffold map

## Objective

Define a concrete scaffold for `adventure-v2` with package boundaries and initial directory targets.

## Acceptance criteria

- `adventure-v2/` root exists with planned package README scaffolds.
- The scaffold includes:
  - `apps/web`,
  - `apps/server`,
  - `packages/contracts`,
  - `packages/cognition`,
  - `packages/control`,
  - `docs`.
- Responsibilities and handoff interfaces are documented for each subproject.

## Requirements

- R1, R2, R3, R4

## Test strategy

- Verify directory and README presence.
- Verify each package doc references contracts-first integration.
- Verify no runtime implementation code is introduced in this planning step.
