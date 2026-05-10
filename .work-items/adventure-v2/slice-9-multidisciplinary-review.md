# Slice 9 multidisciplinary review (Adventure v2 — Cucumber HTTP)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- Cucumber steps call `listenAdventureServer`, `fetch`, and `readSseUntilCount` from [`tests/helpers/httpWire.ts`](../../adventure-v2/tests/helpers/httpWire.ts), matching [`tests/http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts).
- Assertions use the same shapes as Vitest HTTP tests (turn kinds, phases, trace fields, reconcile payload fields).

### Testing / TDD

- Structural extraction of `readSseUntilCount` preceded Cucumber support (tidy-first).
- Behavioral additions: Cucumber setup + scenarios after shared helper existed.

### Security / safety

- Ephemeral port `0`, localhost listener; no credentials or production URLs.

### UX / documentation

- README updated for Slice 9, CI, and split between R1–R5 reference features vs `tests/features/http/`.

### Operability

- CI runs `npm run test:cucumber` after Vitest.
- Script uses `node --import tsx … cucumber.js` for portability (see issues below).

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| **Cross-platform npm script:** `NODE_OPTIONS='--import tsx'` is unreliable on Windows shells. | Use `node --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber.js …` in `package.json` `test:cucumber`. |
| **README drift:** claimed Gherkin was not executed by Cucumber in CI. | README now describes `tests/features/http/` + `npm run test:cucumber` and CI alignment. |
| **CI gap:** HTTP Gherkin not exercised in workflow. | Added “Cucumber HTTP scenarios” step to [`/.github/workflows/adventure.yml`](../../.github/workflows/adventure.yml). |

## Sign-off

All listed issues addressed; `npm test` and `npm run test:cucumber` expected green from `adventure-v2/`.
