# Slice 14 multidisciplinary review (Adventure v2 — interactive shell, full plan prompts, stub autoplay)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **Multi-turn HTTP** is first-class: [`http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts) asserts two sequential `POST /turns` produce proposals with sequences **1** and **2** (20 SSE events).
- **`CognitionTraceWire`** ([`wire.ts`](../../adventure-v2/packages/contracts/src/http/wire.ts)): optional **`promptSystem`** / **`promptUser`** with **`COGNITION_PROMPT_TEXT_MAX_CHARS`** (16 384); truncation via **`capPromptTextForWire`** in [`promptDigest.ts`](../../adventure-v2/packages/cognition/src/brain/promptDigest.ts) before emission.
- **Autoplay** stays client-orchestrated: browser loops **`POST /turns`** using [`stubPlanNextMove`](../../adventure-v2/apps/web/src/stubAutoplayPlanner.ts); no new routes.

### Testing / TDD

- New Vitest: [`shellState.test.ts`](../../adventure-v2/tests/shellState.test.ts), [`stubAutoplayPlanner.test.ts`](../../adventure-v2/tests/stubAutoplayPlanner.test.ts), [`promptCap.test.ts`](../../adventure-v2/tests/promptCap.test.ts); extended [`wireDisplay.test.ts`](../../adventure-v2/tests/wireDisplay.test.ts), [`contracts.test.ts`](../../adventure-v2/tests/contracts.test.ts), [`http.acceptance.test.ts`](../../adventure-v2/tests/http.acceptance.test.ts).

### Security / safety

- Full prompts are **benchmark/dev telemetry** on SSE; length capped at wire schema + truncation. No new secrets in stub path.
- CORS / body limits unchanged (slices 11–12).

### UX / documentation

- [`apps/web`](../../adventure-v2/apps/web): command input, replay demo button, stub autoplay + stop; replay no longer runs automatically on load.
- README + design + planning queue updated for slice 14.

### Operability

- **`npm test`**, **`npm run test:cucumber`** verified after changes. **`npm run test:oracle-fortran`** when `./adventure` is built (unchanged seam).

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| README still described “sample turn” web shell | Updated [**`README.md`**](../../adventure-v2/README.md) scope + slice **14** bullet for interactive UI and prompts. |
| **`design.md`** wire summary lacked full prompt fields | §3.3 note for optional **`promptSystem`** / **`promptUser`** and cap constant. |
| Planning snapshot still “between plans” / post–slice 13 only | [**`plan-queues-index.md`**](../planning/plan-queues-index.md) snapshot + [**`task.md`**](task.md) slice 14 pointer. |

## Sign-off

Slice 14 scope implemented; regressions:

`npm test && npm run test:cucumber` (add `npm run test:oracle-fortran` after oracle/subprocess edits).
