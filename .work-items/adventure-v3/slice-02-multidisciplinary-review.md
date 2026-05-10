# Multidisciplinary review — adventure-v3 slice 02 (US-4-1 session signals + assist cover)

Audience: UX, architecture, operations. Scope: [`adventure-v3`](../../adventure-v3/) web shell — ancillary assist disclosure, **session signals** from CRT transcript only ([US-4-1](stories/US-4-1-session-signals-visible.md)).

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Session signals must not imply the assistant runs the game | Signals come only from [`deriveSessionSignals`](../../adventure-v3/apps/web/src/session/sessionSignals.ts) on **`transcriptText`**; no commands are emitted from this panel ([`main.ts`](../../adventure-v3/apps/web/src/main.ts)). |
| P0 | Users need an explicit empty/waiting state | **Waiting:** “Waiting for game text…” when transcript is empty or [`CRT_AWAITING_ORACLE_PLACEHOLDER`](../../adventure-v3/apps/web/src/transcript/constants.ts). **Ready, no cues:** “No session cues yet — keep playing.” ([`formatSessionSignalsForPanel`](../../adventure-v3/apps/web/src/session/sessionSignals.ts)). |
| P1 | Ancillary UI must stay optional beside the hero CRT | Native `<details>` **collapsed by default**; summary **Show assist panels** ([`index.html`](../../adventure-v3/apps/web/index.html)). Draft map / XState / LangGraph show honest **Not available in this build.** |
| P1 | Assistive tech: avoid noisy announcements when panels are closed | `#session-signals-panel` uses **`aria-live="off"`** while the cover is collapsed; **`aria-live="polite"`** only when `<details>` is open (`toggle` listener in [`main.ts`](../../adventure-v3/apps/web/src/main.ts)). Single block update (`textContent` with newlines) instead of rebuilding lists per refresh. |
| P1 | Clicking the disclosure must not steal focus from the command line | [`shellClickShouldSkipFocus`](../../adventure-v3/apps/web/src/shell/shellClickFocus.ts) includes **`summary`** ([`shellClickFocus.test.ts`](../../adventure-v3/apps/web/src/shell/shellClickFocus.test.ts)). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Session logic stays testable without DOM | Pure helpers [`extractRecentMoves`](../../adventure-v3/apps/web/src/session/sessionSignals.ts), [`extractLocationCues`](../../adventure-v3/apps/web/src/session/sessionSignals.ts), [`deriveSessionSignals`](../../adventure-v3/apps/web/src/session/sessionSignals.ts); Vitest in [`sessionSignals.test.ts`](../../adventure-v3/apps/web/src/session/sessionSignals.test.ts). |
| P2 | Location cues use a bounded heuristic | Lines **starting with** `YOU ARE` (after trim) — avoids false positives from prose containing “without YOU ARE” ([`sessionSignals.test.ts`](../../adventure-v3/apps/web/src/session/sessionSignals.test.ts)). |
| P2 | Client remains free of LangGraph/Mermaid packages | No new dependencies; placeholders only for future depth panels ([`index.html`](../../adventure-v3/apps/web/index.html)). |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Operators need the regression matrix documented | [`README.md`](../../adventure-v3/README.md) describes Assist strip + points to session signal tests. |
| P2 | Default CI unchanged | `npm run test:cucumber` still synthetic-only; Fortran optional ([`README.md`](../../adventure-v3/README.md)). |

## Verification performed

Commands run successfully during slice 02 implementation (re-run before merge):

- `cd adventure-v3 && npm test -- --run`
- `cd adventure-v3 && npm run test:cucumber`
- `cd adventure-v3 && npm run test:cucumber:fortran` (with repo-root `./adventure`)
- `cd adventure-v3 && npm run build`

## Navigation

[`.work-items/adventure-v3/index.md`](index.md)
