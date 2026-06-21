# Step 05 — Fortran oracle harness

## Objective

Drive `./adventure` with scripted stdin and capture transcripts for regression-style checks.

## Acceptance criteria

- [x] `runFortranScript` runs when `adventure` binary exists.
- [x] Normalized transcript contains expected room text for `n` / `east`.

## Test strategy

`src/engine/subprocessEngine.test.ts` (skipped automatically if binary missing).
