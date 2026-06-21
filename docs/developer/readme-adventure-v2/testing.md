# Testing

**CI gate:** `npm test` then `npm run test:cucumber`. Add `npm run test:oracle-fortran` after oracle edits.

| Layer | Role |
| --- | --- |
| Control / cognition | XState escalation; LangGraph trace order; prompt caps |
| Contracts | Schema regressions in `packages/contracts` |
| In-process acceptance | R1–R5 via `RunCoordinator` without HTTP |
| HTTP + SSE | `http.acceptance.test.ts` — real listener, matches web shell |
| HTTP Gherkin | `npm run test:cucumber` — optional readability layer |
| Fortran oracle | `npm run test:oracle-fortran` — opt-in / CI |

```bash
npm install
npm test
npm run test:cucumber
# optional after make adventure:
npm run test:oracle-fortran
```

See [Testing baseline](../readme-shards/testing-baseline.md).
