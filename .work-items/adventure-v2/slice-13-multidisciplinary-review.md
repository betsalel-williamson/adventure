# Slice 13 multidisciplinary review (Adventure v2 — LangGraph, XState, agent trace observability)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **LangGraph** ([`runTurnBrainGraph.ts`](../../adventure-v2/packages/cognition/src/brain/runTurnBrainGraph.ts)): `perceive` → `plan` → `act` **before** the oracle; **reconcile** trace is emitted after [`classifyReconcile`](../../adventure-v2/packages/cognition/src/reconcile/classifyReconcile.ts) on the server, not as a graph node, to avoid duplicating oracle I/O inside the graph.
- **XState** ([`controlMachine.ts`](../../adventure-v2/packages/control/src/machine/controlMachine.ts)): `createMachine` + `createActor`; **`invalidRouting`** transient state implements invalid-count escalation without invalid multi-target edge syntax.
- **Wire** ([`wire.ts`](../../adventure-v2/packages/contracts/src/http/wire.ts)): Optional **`graphNodeId`**, **`stepIndex`**, **`promptDigest`**, **`promptSummary`**, **`promptRole`** on **`CognitionTraceWire`** for observability without breaking older clients (unknown fields were already in **`payload`**).
- **Checkpoint boundary**: HTTP **`CheckpointRegistry`** unchanged; **LangGraph MemorySaver** / graph checkpoints are **not** unified with **`CheckpointRef`** in this slice (explicit deferral).

### Testing / TDD

- Vitest: **`processTurn`** is **`async`**; all acceptance/oracle tests **`await`** ([`acceptance.test.ts`](../../adventure-v2/tests/acceptance.test.ts), [`oracleProcess.test.ts`](../../adventure-v2/tests/oracleProcess.test.ts), [`oracleFortran.ci.test.ts`](../../adventure-v2/tests/oracleFortran.ci.test.ts)).
- HTTP + Cucumber: **10** SSE events per nominal turn (4 turn + 4 trace + 2 phase); steps and features updated ([`http_steps.ts`](../../adventure-v2/tests/cucumber/http_steps.ts), [`stream_turn_order.feature`](../../adventure-v2/tests/features/http/stream_turn_order.feature)).
- New [**`controlMachine.test.ts`**](../../adventure-v2/tests/controlMachine.test.ts) for XState paths; contracts test for **golden** trace node order + extended schema.

### Security / safety

- **No new network I/O** in the default path: **stub** prompts and **SHA-256** digests only; no API keys in traces beyond existing run config.
- **CORS** and **body size** behavior unchanged (slices 11–12).

### UX / documentation

- [**`wireDisplay.ts`**](../../adventure-v2/apps/web/src/wireDisplay.ts): cognition trace panel shows optional digest/summary/step fields when present.
- [**`README.md`**](../../adventure-v2/README.md): Slice 13 bullet, dependency narrative (LangGraph + xstate), test pyramid row for control/cognition tests.
- [**`design.md`**](design.md) §3.3 / §5 aligned with implementation vs deferrals.

### Operability

- **`npm test`**, **`npm run test:cucumber`**, **`npm run test:oracle-fortran`** (when `./adventure` exists + **`ADV_V2_CI_FORTRAN=1`**) verified locally.

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| **`processTurn`** became asynchronous; callers must **`await`** | Updated **`createServer`** POST turn handler and all Vitest callers; documented in README slice 13. |
| **SSE event count** per turn increased from **7** → **10** | Updated **`http.acceptance.test.ts`**, Cucumber **`readSseUntilCount`** and Gherkin assertions. |
| **Single “proposal” trace** replaced by LangGraph steps | HTTP test asserts **`['perceive','plan','act','reconcile']`** and **`plan.promptDigest`** shape; feature step renamed to match. |
| Planning snapshot still pointed at slice **12** only | Updated **[`plan-queues-index.md`](../planning/plan-queues-index.md)** and **[`task.md`](task.md)**; archive pointer [**`adventure-v2-slice-13-langgraph-xstate.plan.md`](adventure-v2-slice-13-langgraph-xstate.plan.md)**. |

## Sign-off

Slice 13 scope implemented; regressions green:

`npm test && npm run test:cucumber && npm run test:oracle-fortran` (Fortran step when binary present).
