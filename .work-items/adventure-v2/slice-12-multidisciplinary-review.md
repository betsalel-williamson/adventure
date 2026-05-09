# Slice 12 multidisciplinary review (Adventure v2 — configurable CORS)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **`ADV_V2_CORS_ORIGINS`** (`apps/server/src/http/createServer.ts`): comma-separated allowlist; unset or blank preserves **`Access-Control-Allow-Origin: *`**. Restricted mode reflects **`Origin`** only when it matches an allowlist entry exactly; otherwise **`Access-Control-Allow-Origin`** is omitted on JSON, SSE, and **`OPTIONS`** responses.
- **Single code path:** `corsHeadersForRequest(req)` feeds `sendJson`, **`OPTIONS`**, **`204`** turn responses, and SSE **`writeHead`** so CORS cannot drift between routes.

### Testing / TDD

- Vitest [**`http.acceptance.test.ts`**](../../adventure-v2/tests/http.acceptance.test.ts): dedicated **`CORS allowlist`** describe block; env saved/restored with **`beforeEach` / `afterEach`**; imports **`ADV_V2_CORS_ORIGINS_ENV`** from the server package for stable env key usage.
- Cucumber HTTP features unchanged; default wildcard behavior keeps existing steps green without env.

### Security / safety

- Restricted mode avoids **``*`** with arbitrary **`Origin`**—only listed origins receive **`Access-Control-Allow-Origin`**. Non-browser clients without **`Origin`** omit ACAO in restricted mode (acceptable for server-to-server calls; browsers always send **`Origin`** on cross-origin fetches that matter for CORS).

### UX / documentation

- [**`adventure-v2/README.md`**](../../adventure-v2/README.md): Slice 12 bullet, HTTP table **`OPTIONS`** row semantics, **Not yet** adjusted (CORS removed from backlog), Local dev example for **`ADV_V2_CORS_ORIGINS`**.
- [**`design.md`**](design.md) §3.1: **CORS** paragraph aligned with README.

### Operability

- CI unchanged: **`npm test`** then **`npm run test:cucumber`**. No new env required in CI (wildcard default). Operators may set **`ADV_V2_CORS_ORIGINS`** in deployment environments without code changes.

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| [`.work-items/adventure-v2/task.md`](task.md) **Implementation status** did not mention Slice 12 or where to read CORS behavior. | Added a Slice 12 line pointing at README and HTTP acceptance tests. |
| Planning snapshot and “next” pointer still describe pre–Slice 12 state ([`plan-queues-index.md`](../planning/plan-queues-index.md), [`work-in-progress.md`](../planning/work-in-progress.md)). | Updated loop snapshot, Finished queue, **Next after this**, and work-in-progress date/pointer. |
| No work-items archive pointer for this slice (parity with Slice 11 plan notes). | Added [`adventure-v2-slice-12-configurable-cors.plan.md`](adventure-v2-slice-12-configurable-cors.plan.md). |

## Sign-off

Issues above addressed; run from `adventure-v2/`:

`npm test && npm run test:cucumber`

Oracle subprocess and Fortran bridge paths were not modified; `npm run test:oracle-fortran` not required for Slice 12 verification beyond existing CI.
