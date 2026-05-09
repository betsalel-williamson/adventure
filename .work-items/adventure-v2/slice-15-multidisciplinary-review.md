# Slice 15 multidisciplinary review (Adventure v2 — virtual terminal lane)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **No wire changes:** Presentation-only; [`SseWireEvent`](../../adventure-v2/packages/contracts/src/http/wire.ts) unchanged. Virtual terminal content derives from existing `proposal` and `oracle_observation` turn envelopes plus **client-side** `formatVirtualTerminalUserEcho` after successful `POST /turns` (chronology: echo → SSE proposal → SSE oracle text per [`runCoordinator.ts`](../../adventure-v2/apps/server/src/run/runCoordinator.ts) emission order after REST completes).

### Testing / TDD

- New Vitest coverage in [`wireDisplay.test.ts`](../../adventure-v2/tests/wireDisplay.test.ts): `formatVirtualTerminalUserEcho`, `formatVirtualTerminalTurnChunk`, `formatVirtualTerminalWireChunk`.
- HTTP/Cucumber unchanged; full regression `npm test` + `npm run test:cucumber` green.

### Security / safety

- Game terminal repeats oracle output already on SSE; no new secrets. Prompts remain in cognition trace panel only.

### UX / documentation

- [`index.html`](../../adventure-v2/apps/web/index.html): **game terminal** `<pre>` + **Show raw SSE log** toggle (hides debug block).
- [`main.ts`](../../adventure-v2/apps/web/src/main.ts): maintains parallel `gameTerminalText` buffer; echoes trimmed input on successful turn POST.
- [`README.md`](../../adventure-v2/README.md): **v1-like terminal MVP** subsection — Fortran bridge command table, remaining MVP gaps (SLM, XState snapshot, checkpointer, Playwright).
- [`design.md`](design.md) §3.3: slice 15 web-app note with README pointer.

### Operability

- **`npm test`**, **`npm run test:cucumber`** verified. **`npm run test:oracle-fortran`** when `./adventure` is built (unchanged oracle seam).

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| README lacked a single place for Fortran dev vs synthetic oracle + MVP gap list | Added **v1-like terminal MVP** subsection with command table and **Remaining gaps** bullets. |
| **`design.md`** web-app bullet did not mention game terminal | §3.3 references slice 15 + README. |
| Planning snapshot still pointed at slice 14 as latest terminal work | Updated **[`plan-queues-index.md`](../planning/plan-queues-index.md)** snapshot + **[`task.md`](task.md)** slice 15 pointer. |

## Sign-off

Slice 15 scope implemented; regressions:

`npm test && npm run test:cucumber` (add `npm run test:oracle-fortran` after oracle/subprocess edits).
