# Slice 10 multidisciplinary review (Adventure v2 — R5 on HTTP wire)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- HTTP `POST /runs/:id/turns` accepts optional `forceReject` ([`postTurnRequestSchema`](../../adventure-v2/packages/contracts/src/http/wire.ts)); [`createServer.ts`](../../adventure-v2/apps/server/src/http/createServer.ts) forwards it to `RunCoordinator.processTurn`.
- Phase transitions on SSE match [`runCoordinator.ts`](../../adventure-v2/apps/server/src/run/runCoordinator.ts): invalid oracle observations route through `control.onInvalidAction`; after enough rejects the control machine reaches `chaos` ([`controlMachine.ts`](../../adventure-v2/packages/control/src/machine/controlMachine.ts)).
- Vitest and Cucumber share [`readSseUntilCount`](../../adventure-v2/tests/helpers/httpWire.ts) and the same event-count assumption (7 wire events per turn).

### Testing / TDD

- **Vitest first:** [`http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts) asserts `test` and `chaos` appear among phase `transition.to` values after three `forceReject` turns (aligned with in-process R5 in [`acceptance.test.ts`](../../adventure-v2/tests/acceptance.test.ts)).
- **Cucumber second:** [`r5_invalid_action_recovery.feature`](../../adventure-v2/tests/features/http/r5_invalid_action_recovery.feature) + [`http_steps.ts`](../../adventure-v2/tests/cucumber/http_steps.ts) reuse the same counts and inputs; no duplicate SSE parsing logic.
- **Regression discipline:** Full gate is `npm test` then `npm run test:cucumber` (mirrors the **adventure-v2** job in [`.github/workflows/adventure.yml`](../../.github/workflows/adventure.yml)); documented in [`adventure-v2/README.md`](../../adventure-v2/README.md) under Testing strategy and Verification.

### Security / safety

- Tests use ephemeral ports and localhost; no secrets; synthetic oracle only for this scenario.

### UX / documentation

- README Slice 10 bullet describes Vitest + Gherkin coverage; Verification section clarifies Cucumber includes the R5 scenario.

### Operability

- CI unchanged: Vitest, then Cucumber, then Fortran oracle job; no new scripts.

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| README did not spell out the **full regression** command sequence (`npm test` then `npm run test:cucumber`) as the pre-merge gate. | Added explicit **Process** sentence and aligned **Verification** comments in [`adventure-v2/README.md`](../../adventure-v2/README.md). |
| Planning snapshot still referenced optional Cucumber as “next.” | Updated [`.work-items/planning/plan-queues-index.md`](../../.work-items/planning/plan-queues-index.md) and [`work-in-progress.md`](../../.work-items/planning/work-in-progress.md) during Slice 10. |
| TypeScript flagged a circular inference on fetch to paths ending in `/turns` when the response variable name interacted with the template string. | Build [`turnsPath`](../../adventure-v2/tests/cucumber/http_steps.ts) separately and annotate `Response` on the fetch result. |

## Sign-off

Issues above addressed; run from `adventure-v2/`:

`npm test && npm run test:cucumber`

Oracle subprocess code was not modified in this slice; `npm run test:oracle-fortran` not required for Slice 10 verification beyond existing CI.
