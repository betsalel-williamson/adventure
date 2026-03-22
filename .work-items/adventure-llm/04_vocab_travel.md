# Step 04 — Vocabulary helpers

## Objective

Expose Fortran-style vocabulary lookup (`ATAB` / `KTAB`) for NL validation.

## Acceptance criteria

- [x] `findVocabIndex` resolves words such as `ROAD`, `EAST`.
- [x] `toA5` pads to five characters.

## Test strategy

`src/vocab/vocab.test.ts`.
