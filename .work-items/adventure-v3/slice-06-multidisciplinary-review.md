# Multidisciplinary review — adventure-v3 slice 06 (pre-commit shell refactor + exploration map hardening)

Audience: UX, architecture, operations. Scope: **CRT shell wiring** extraction ([`main.ts`](../../adventure-v3/apps/web/src/main.ts) → [`wireExplorationMapControls.ts`](../../adventure-v3/apps/web/src/shell/wireExplorationMapControls.ts), [`wireLegacyAssistControls.ts`](../../adventure-v3/apps/web/src/shell/wireLegacyAssistControls.ts)), **run-scoped client exploration graph** ([`explorationMapUpdate.ts`](../../adventure-v3/apps/web/src/assist/explorationMapUpdate.ts)), **ingest parse-fail messaging**, **Cucumber** assist health field hygiene, **Vitest** colocated web tests.

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Default product unchanged | Feature defaults remain in [`v3-feature-flags.json`](../../adventure-v3/apps/web/v3-feature-flags.json); wiring is move-only + clearer status when assist JSON does not parse. |
| P1 | Operators see honest map provenance | Successful assist graph: **Draft map updated.** Local-only merge: **Draft map updated (local merge).** Ingest OK but invalid graph JSON: **Assist map response unreadable — using local merge.** |
| P1 | New session must not show prior run’s exploration graph | Client tracks `previousRunId`; graph resets when `runId` changes before merge/render ([`explorationMapUpdate.ts`](../../adventure-v3/apps/web/src/assist/explorationMapUpdate.ts)). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Single orchestration file | `main` owns bootstrap, transcript, SSE, and **calls** shell wire modules; legacy Assist DOM listeners live in [`wireLegacyAssistControls.ts`](../../adventure-v3/apps/web/src/shell/wireLegacyAssistControls.ts); exploration copy/hide in [`wireExplorationMapControls.ts`](../../adventure-v3/apps/web/src/shell/wireExplorationMapControls.ts). |
| P1 | Client graph vs server `graphsByRunId` | Browser exploration column state is still local; run alignment matches server session key via `runId` argument on each refresh. |
| P2 | Cucumber world fields | Assist health JSON stored on **`assistHealthBody`** so it cannot collide with adventure **`healthBody`** ([`http_world.ts`](../../adventure-v3/tests/cucumber/http_world.ts), [`assist_steps.ts`](../../adventure-v3/tests/cucumber/steps/assist_steps.ts)). |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Pre-commit gate | From `adventure-v3/`: **`npm run verify`** (lint, Prettier, Vitest projects `node` + `web`, Cucumber wire, production build). |
| P2 | Web-only unit tests | `npm run test:web` runs **`vitest run --project web`** for jsdom specs under `apps/web/`. |

## Verification performed

Commands run successfully:

- `cd adventure-v3 && npm run verify`

## Navigation

[`.work-items/adventure-v3/index.md`](index.md)
