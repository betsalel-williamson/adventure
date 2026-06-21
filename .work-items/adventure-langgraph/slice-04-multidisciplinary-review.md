> **Historical:** Superseded for **default product direction** by the exploration map reset (map column + feature flags). Retained for regression when legacy Assist / probe flags are enabled.

# Multidisciplinary review — adventure-v3 slice 04 (US-4-3 user chooses assistance posture)

Audience: UX, architecture, operations. Scope: [`adventure-v3`](../../adventure-langgraph/) web shell — **selectable** assistance postures with confirmation and stale-preview messaging ([US-4-3](stories/US-4-3-user-chooses-assistance-posture.md)), extending slice 03 layout.

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | User **chooses** posture before relying on assist behavior | Fieldset with radios **Quick assist** / **Study first** ([`index.html`](../../adventure-langgraph/apps/web/index.html)); values match [`AssistancePostureId`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts). |
| P0 | **Confirmation** of new posture before downstream assist outputs | [`formatPostureChangeAcknowledgment`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) drives `#posture-change-status` (`role="status"`, `aria-live="polite"`) on change ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)). |
| P0 | Notice when prior previews may be **stale** after posture change | [`POSTURE_CHANGE_STALE_NOTICE`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) in `#posture-stale-notice` (`role="status"`, `aria-live="polite"`); **Dismiss** clears visibility without affecting selection. |
| P1 | Honest rules per posture remain bounded | Copy pinned in Vitest ([`assistancePosture.test.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.test.ts)); **Study first** emphasizes confirmation before draft/suggestion changes ([E4 glossary](epics/E4-session-awareness-and-agent-surfacing.md)). |
| P2 | Long posture rules stay **static** for assistive tech | `#assistance-posture-panel` remains **`aria-live="off"`**; live announcements limited to status + stale banner ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts) session-signals pattern unchanged). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Single catalog for ids, copy, and UI order | [`ORDERED_ASSISTANCE_POSTURE_IDS`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts), [`isAssistancePostureId`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts), [`parseStoredAssistancePostureId`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) ([design-agentic-mvp.md](design-agentic-mvp.md) §3.2). |
| P1 | Persistence without new HTTP contracts | [`sessionStorage`](../../adventure-langgraph/apps/web/src/main.ts) key [`ASSISTANCE_POSTURE_STORAGE_KEY`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts); invalid values fall back to default. |
| P2 | Posture router / assist endpoints | **Deferred** — display + client persistence only; HTTP routing remains future work ([design-agentic-mvp.md](design-agentic-mvp.md) §3.1). |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Operators need regression matrix + storage key | [`README.md`](../../adventure-langgraph/README.md) Assist paragraph documents posture pair + `sessionStorage` key; tests unchanged command list. |
| P2 | Default CI unchanged | Same gates as slice 03; Fortran Cucumber optional when oracle wiring untouched ([`README.md`](../../adventure-langgraph/README.md)). |

## Verification performed

Commands run successfully for slice 04:

- `cd adventure-langgraph && npm test -- --run`
- `cd adventure-langgraph && npm run test:cucumber`
- `cd adventure-langgraph && npm run build`

## Navigation

[`.work-ite../adventure-langgraph/index.md`](index.md)
