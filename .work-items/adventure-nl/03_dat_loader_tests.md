# Step 03 — `.dat` loader tests

## Objective

Load `adventure.dat` sections (1–6) into typed structures with Vitest coverage.

## Acceptance criteria

- [x] Loader reads long/short text, motion, vocabulary, comments, messages.
- [x] `IKIND` `0` terminator ends parsing.
- [x] Vocabulary `ATAB` fields are five characters (padded).

## Test strategy

`src/dat/loadDat.test.ts` against repository `adventure.dat`.
