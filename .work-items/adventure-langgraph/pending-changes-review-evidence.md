# Regression evidence — pending changes (multidisciplinary review prep)

Captured for reviewers and CI forensics. **Do not treat as a permanent contract**; re-run before release if the branch moved.

| Field | Value |
| --- | --- |
| **Commit** | `6e93f0365301727ee9798f4e575f4a7e5d9b85dd` |
| **Branch** | `feature/adventure-llm` |
| **Host** | Local dev run (see timestamps in shell logs if re-running) |

## Regression matrix (plan)

| Step | Command | Result |
| --- | --- | --- |
| v2 unit | `cd adventure-v2 && npm test -- --run` | **PASS** — 16 files, 90 tests |
| v2 Fortran CI | `cd adventure-v2 && npm run test:oracle-fortran` | **PASS** — 1 file, 2 tests (requires repo-root `./adventure`) |
| v3 unit | `cd adventure-langgraph && npm test -- --run` | **PASS** — 4 files, 13 tests |
| v3 Cucumber (synthetic) | `cd adventure-langgraph && npm run test:cucumber` | **PASS** — 2 scenarios, 6 steps |
| v3 Fortran Cucumber | `cd adventure-langgraph && npm run test:cucumber:fortran` | **PASS** — 1 scenario, 4 steps (requires `./adventure`) |
| v3 build | `cd adventure-langgraph && npm run build` | **PASS** — Vite production build |
| v2 HTTP Cucumber (extra) | `cd adventure-v2 && npm run test:cucumber` | **PASS** — 3 scenarios, 19 steps |

## Notes

- **Fortran rows** only apply when the repo-root `adventure` binary exists and is executable (`make adventure` from repository root).
- v2 default `npm test` sets `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1` per `vitest.config.ts`; use `test:oracle-fortran` for subprocess integration.

## Navigation

[`.work-ite../adventure-langgraph/pending-changes-review-session-notes.md`](pending-changes-review-session-notes.md) · [slice-01-multidisciplinary-review.md](slice-01-multidisciplinary-review.md)
