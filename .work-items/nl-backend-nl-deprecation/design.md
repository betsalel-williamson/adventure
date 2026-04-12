# Design: Transition — deprecate server-forward NL cognition

## Objective

Phase out reliance on **Node HTTP endpoints that forward NL planner/interpret requests** to the text-model pool for the **default web dashboard** path, in favor of **browser-direct** model calls ([`planAutoplayInBrowser`](../../adventure-nl/src/nl/browserPlanAutoplay.ts)) while preserving **Fortran I/O**, **SSE**, **session**, and **packaging discovery** on the server—matching the architecture intent: **cognition does not require backend LLM forwarding**.

## Technical design

### Current vs target

| Concern | Current (mixed) | Target (dashboard default) |
|--------|------------------|----------------------------|
| Autoplay planning | ~~`POST /api/nl/planner`~~ | `planAutoplayInBrowser` + `browserPlanner` (done) |
| Manual interpret | `POST /api/nl/interpret` | Browser-direct interpret (same pattern as planner; TDD first) |
| Server routes | Implemented | Marked **legacy**; optional sunset headers / env-gated removal |
| CLI / `BROWSER_ORCHESTRATED=0` | Node `TextLlm` | Unchanged until explicitly migrated |

### Backend responsibilities (unchanged)

- Run **`adventure`**, stream **`/events`**, accept **`POST /api/engine/input`**.
- **`GET /api/text-llm`**: `current`, `backends`, **`packaging`** ([ADR0004](../../docs/decisions/ADR0004-backend-llm-packaging-and-discovery.md)), **`browserPlanner`** when applicable.
- Subsystem replica, benchmark DB, and other non-NL-forward concerns.

### TDD approach (project process-03)

1. **Red:** Add a failing test that defines the desired contract (e.g. “default browser orchestrator never requests `/api/nl/planner`”, or “legacy handler emits deprecation notice”).
2. **Green:** Minimal code to pass.
3. **Refactor:** Only after green; separate structural commits from behavioral commits per project rules.

**Test layers:**

- **Unit:** `browserPlanAutoplay`, nl-glue guards, pure glue.
- **Contract:** Existing `webDashboardNlHttpContract.test.ts` evolves to assert **deprecation** semantics on legacy routes rather than treating them as primary.
- **Integration / drift:** Optional tests that **`buildAutoplayPlannerPrompt`** + HTTP body shape stay consistent with **`HttpOpenAiCompatibleTextLlm` / `GoogleGenerativeAiTextLlm`** for the same logical inputs (or document explicit exceptions).

### Key changes

#### 3.1 API contracts

- Legacy **`POST /api/nl/planner`**: document as deprecated; add **`Deprecation`** header and/or JSON `deprecated: true` in responses (implementation task).
- **`POST /api/nl/interpret`**: same treatment when browser interpret ships.
- No new dashboard features should depend on these routes.

#### 3.2 Data models

- **`browserPlanner`** payload shape on SSE and **`GET /api/text-llm`** remains the **configuration** surface for client-direct calls (not NL processing).

#### 3.3 Component responsibilities

- **`browserAutoplayOrchestrator.js`**: remains free of `postNlPlanner` (verify in tests).
- **`app.js`**: migrate manual NL from `postNlInterpret` to client interpret module when ready.

## Alternatives considered

- **Central server proxy for all providers** — Rejected for dashboard default (see ADR0015).
- **WASM MLX in the browser** — Out of scope for this transition; MLX remains server-side.

## Out of scope

- Removing the Node **`TextLlm` pool** entirely (CLI still needs it).
- Production hosting of the dashboard on a non-localhost origin without a revised secrets strategy.

## References

- [ADR0015](../../docs/decisions/ADR0015-deprecate-server-forward-nl-cognition.md)
- [ADR0005](../../docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md)
- [docs/architecture/adventure-nl-cognition-and-workspace.md](../../docs/architecture/adventure-nl-cognition-and-workspace.md)
