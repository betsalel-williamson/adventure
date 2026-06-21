> **Historical:** Superseded for **default product direction** by the exploration map reset (map column + feature flags). Retained for regression when legacy Assist / probe flags are enabled.

# Multidisciplinary review — adventure-v3 slice 03 (US-4-2 assistance posture visible)

Audience: UX, architecture, operations. Scope: [`adventure-v3`](../../adventure-langgraph/) web shell — ancillary Assist disclosure with **assistance posture** copy ([US-4-2](stories/US-4-2-operating-posture-visible.md)), built on the slice 02 layout ([US-4-1](stories/US-4-1-session-signals-visible.md)).

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Users must see **which posture** is active in everyday words | **Quick assist** appears as `Current posture: Quick assist` from [`formatAssistancePostureForPanel`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) in `#assistance-posture-panel` ([`index.html`](../../adventure-langgraph/apps/web/index.html)), **above** Session signals inside the expanded stack. |
| P0 | Users must see **what to expect** and **what the assistant avoids** | Sections **What to expect:** and **What this posture avoids:** with bounded bullets in [`assistancePosture.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts); copy pinned in [`assistancePosture.test.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.test.ts). |
| P0 | Posture must not imply the assistant **runs the game** | Avoid list explicitly rejects issuing commands without user input; posture panel does **not** emit wire commands ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)). |
| P1 | **Draft apply** policy visible **before** any apply control exists | Section **Draft maps and apply:** states confirmation expectation for a future apply action and that **no apply control exists in this build**; Fortran remains authority ([`assistancePosture.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts)). |
| P1 | Single posture without a picker is allowed until more ship ([US-4-3](stories/US-4-3-user-chooses-assistance-posture.md)) | Only [`quickAssist`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) is defined; [`DEFAULT_ASSISTANCE_POSTURE_ID`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) documents default selection for future US-4-3 wiring. |
| P2 | Assistive tech: posture text is **static** while session signals **update** | `#assistance-posture-panel` stays **`aria-live="off"`** (no noisy repeats); dynamic session content keeps **`aria-live`** gated when the assist cover opens ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Posture labels live in **one catalog** for UI and tests | [`AssistancePostureId`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) + `CATALOG` + [`describeAssistancePosture`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts) ([`design-agentic-mvp.md`](design-agentic-mvp.md) §3.2). |
| P1 | Posture logic stays testable without DOM | Pure [`formatAssistancePostureForPanel`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.ts); Vitest in [`assistancePosture.test.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.test.ts). |
| P2 | Posture router / HTTP assist endpoints | **Deferred** to US-4-3+ ([`design-agentic-mvp.md`](design-agentic-mvp.md) §3.1); this slice is display-only. |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Operators need the regression matrix and posture test pointer | [`README.md`](../../adventure-langgraph/README.md) Assist paragraph + Tests bullet reference [`assistancePosture.test.ts`](../../adventure-langgraph/apps/web/src/posture/assistancePosture.test.ts). |
| P2 | Default CI unchanged | Same gates as slice 02; Fortran Cucumber optional when transcript/oracle wiring is untouched ([`README.md`](../../adventure-langgraph/README.md)). |

## Verification performed

Commands run successfully during slice 03 implementation:

- `cd adventure-langgraph && npm test -- --run`
- `cd adventure-langgraph && npm run build`
- `cd adventure-langgraph && npm run test:cucumber`

## Navigation

[`.work-ite../adventure-langgraph/index.md`](index.md)
