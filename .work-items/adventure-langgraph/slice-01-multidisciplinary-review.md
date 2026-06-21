# Multidisciplinary review — adventure-v3 slice 01 (CRT shell + Fortran wire)

Audience: UX, architecture, operations. Scope: [`adventure-v3`](../../adventure-langgraph/) thin client + [`adventure-v2`](../../adventure-v2/) HTTP oracle wiring consumed by that client.

**Regression packet:** [pending-changes-review-evidence.md](pending-changes-review-evidence.md) · **Session runner / decisions:** [pending-changes-review-session-notes.md](pending-changes-review-session-notes.md)

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Users cannot tell if Fortran is active without reading logs | Status strip uses plain-language copy from `GET /health` ([`describeHealthStatus`](../../adventure-langgraph/apps/web/src/status/health.ts)). |
| P1 | Command field should be easy to reach after load | `focus()` on `#command-input` after bootstrap ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)). |
| P1 | Transcript updates should be announced when using assistive tech | `aria-live="polite"` on `#crt-transcript` ([`index.html`](../../adventure-langgraph/apps/web/index.html)). |
| P1 | Transcript should behave like a terminal (scroll tail-follow vs reading history) | Flex-filled CRT viewport + pinned scroll: follow tail only when near bottom or after **Send** ([`crt-shell.css`](../../adventure-langgraph/apps/web/styles/crt-shell.css), [`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)). |
| P2 | Hero transcript feels empty before first room text | Silent bootstrap (`POST /turns` with empty `input` after SSE opens) declines instructions without painting an extra `look` ([`main.ts`](../../adventure-langgraph/apps/web/src/main.ts)); cognition **proposal** lines hidden from CRT (`appendFromWire`). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Cucumber must mirror CLI oracle resolution — synthetic vs process oracle must match `GET /health` | Hooks branch like [`cli.ts`](../../adventure-v2/apps/server/src/cli.ts): `resolveOracleStartupConfig()` → **`bridge_script`** uses [`createProcessOracleBridge`](../../adventure-v2/apps/server/src/oracle/processOracleBridge.ts); **`persistent_fortran`** uses [`createPersistentFortranOracleBridge`](../../adventure-v2/apps/server/src/oracle/persistentFortranOracleBridge.ts); else [`createSyntheticOracleBridge`](../../adventure-v2/apps/server/src/oracle/oracleBridge.ts) ([`http_hooks.ts`](../../adventure-langgraph/tests/cucumber/http_hooks.ts)). |
| P0 | Oracle observation may be asynchronous | [`RunCoordinator`](../../adventure-v2/apps/server/src/run/runCoordinator.ts) awaits `Promise.resolve(oracle.observe(...))`; bridges may return sync or async ([`oracleBridge.ts`](../../adventure-v2/apps/server/src/oracle/oracleBridge.ts)). |
| P1 | Keep client free of LangGraph/Mermaid | `adventure-v3` depends only on `@contracts` types and fetch/EventSource; no cognition packages. |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Operators need a predictable test matrix | [`README.md`](../../adventure-langgraph/README.md) documents API dependency, ports (**5174** default for v3 `npm start` vs **5173** for v2-only web), and Fortran Cucumber script. |
| P1 | Default CI should not require Fortran | `npm run test:cucumber` runs baseline `.feature` files; `npm run test:cucumber:fortran` is optional when `./adventure` exists. |
| P1 | **`GET /health`** when auto-Fortran is active reports `processOracleScript: "adventure"` (basename), not `oracle-fortran-bridge.mjs` | Documented in [`adventure-v2/README.md`](../../adventure-v2/README.md) **Verify `/health`** table; scripts must not key off the old bridge basename for persistent mode. |

## Verification performed

See [pending-changes-review-evidence.md](pending-changes-review-evidence.md) for commit SHA and command results. Summary:

- `cd adventure-v2 && npm test -- --run`
- `cd adventure-v2 && npm run test:oracle-fortran` (with repo-root `./adventure`)
- `cd adventure-langgraph && npm test -- --run`
- `cd adventure-langgraph && npm run test:cucumber`
- `cd adventure-langgraph && npm run test:cucumber:fortran` (optional, with `./adventure`)
- `cd adventure-langgraph && npm run build`

## Navigation

[`.work-ite../adventure-langgraph/index.md`](index.md)
