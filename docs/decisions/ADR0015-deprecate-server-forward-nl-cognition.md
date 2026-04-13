# ADR0015: Deprecate server-forward NL cognition (dashboard path)

## Context

### Problem

The web dashboard must **not** treat the Node HTTP layer as the primary place where **natural-language cognition** (autoplay planning and, in the target state, interpret) **calls text models**. Cognition policy and prompt assembly already live in **`@adventure-nl/nl-glue`** and run in the **browser** ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md), [ADR0014](ADR0014-two-step-nl-glue-package-then-browser.md)). A separate historical implementation forwarded **`POST /api/nl/planner`** (and related aliases) through the server’s **`TextLlm` pool**, which duplicated the user’s intent: **planning should not depend on backend round-trips** for the default dashboard experience.

**Autoplay planning** now uses **`planAutoplayInBrowser`** ([`adventure-nl/src/nl/browserPlanAutoplay.ts`](../../adventure-nl/src/nl/browserPlanAutoplay.ts)), bundled for the client, with **`browserPlanner`** credentials delivered on SSE **`text_llm`** and **`GET /api/text-llm`** so the browser calls **Gemini** or **OpenAI-compatible HTTP** directly. That path is the **intended** dashboard architecture.

**Constraints:**

- **MLX** text models still require a **server-side stdio worker**; the browser cannot run that worker. Browser-orchestrated autoplay with **MLX** remains **unsupported** until a separate client-reachable bridge exists—or operators use **server-orchestrated** NL (`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0`) or switch to **google** / **http** providers.
- **[ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)** remains valuable for **packaging discovery** (`packaging` on **`GET /api/text-llm`**) and for **Node** callers (CLI, tests, optional server-orchestrated web). Browser-direct calls must **stay aligned** with provider behavior (tests below).

### Forces

- **Intent clarity:** Documentation and HTTP surface should not imply that **`POST /api/nl/*`** is the “real” dashboard cognition API.
- **TDD:** Deprecation is proven by tests: contract tests, parity or shared assertions where wire formats overlap, and eventual removal or `410 Gone` behind a flag.
- **Small batches:** Remove or narrow server handlers incrementally; keep CLI and automation working until explicitly migrated.

## Decision

1. **Declare server-forward NL routes legacy for the dashboard default path:** **`POST /api/nl/planner`**, **`/api/llm/plan`**, **`/api/autoplay-plan`**, and (until migrated) **`POST /api/nl/interpret`** / aliases exist for **compatibility, CLI-adjacent tools, and server-orchestrated modes**—not as the architecture we extend for new dashboard cognition features.

2. **Target runtime (dashboard, browser-orchestrated autoplay):** **No** planner **`fetch`** to those routes; cognition calls models **from the browser** using **`browserPlanner`** + **`planAutoplayInBrowser`** (and, when implemented, the same pattern for **interpret**).

3. **Phased deprecation (implementation plan):** Follow [`.work-items/nl-backend-nl-deprecation/task.md`](../../.work-items/nl-backend-nl-deprecation/task.md): document → test matrix → optional **`Deprecation`** / **`Sunset`** response headers or structured JSON fields → reduce log noise → eventually **`410`** or removal behind **`ADVENTURE_NL_ALLOW_LEGACY_NL_FORWARD`** (name illustrative).

4. **Packaging alignment:** Where the browser sends vendor-specific payloads, **Vitest** must guard against drift from Node **`TextLlm` providers** (shared constants from **`@adventure-nl/nl-glue`**, snapshot or cross-check tests, or thin shared modules)—see work-item **Test strategy**.

## Alternatives considered

- **Keep server-forward as default for simplicity** — Rejected: contradicts the stated product architecture (client-owned cognition, thin backend for Fortran/SSE/session).

- **Remove legacy routes immediately** — Rejected: breaks external scripts and `ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0` parity until CLI paths are explicitly updated; prefer phased deprecation with tests.

- **Single “gateway” POST that only proxies for MLX** — Deferred: could reduce surface area later; does not change the rule that **dashboard google/http** paths do not use it.

## Consequences

**Positive**

- One clear story: **browser** = cognition + orchestration for the default dashboard; **Node** = Fortran, SSE, pool for CLI/server modes, discovery, subsystem replica, session.

- Deprecation can be **test-gated** and reversible during the transition.

**Negative**

- **Dual wire paths** (browser `fetch` vs Node providers) require discipline to keep **`@adventure-nl/nl-glue`**-level behavior and ADR0004 **discovery** accurate.

- **Secrets on the wire:** `browserPlanner` exposes keys to the page for localhost development; operational docs must keep **127.0.0.1** binding and “no public exposure” prominent ([`API_DOCUMENTATION.md`](../../API_DOCUMENTATION.md)).

## Rationale

The team’s intent is explicit: **NL planning must not be implemented as “call the backend to call the model.”** This ADR records that as an architectural decision, links the migration plan, and ties deprecation to **TDD** and **documentation** updates so future work does not reintroduce server-forward as the default dashboard path.

## Status

Accepted

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — Browser-orchestrated cognition.
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — Packaging discovery; Node providers.
- [ADR0014](ADR0014-two-step-nl-glue-package-then-browser.md) — NL glue package + browser bundle.
- [`.work-items/nl-backend-nl-deprecation/design.md`](../../.work-items/nl-backend-nl-deprecation/design.md) — Feature design and phases.
- [`adventure-nl/src/nl/browserPlanAutoplay.ts`](../../adventure-nl/src/nl/browserPlanAutoplay.ts), [`adventure-nl/public/browserAutoplayOrchestrator.js`](../../adventure-nl/public/browserAutoplayOrchestrator.js)
- [`API_DOCUMENTATION.md`](../../API_DOCUMENTATION.md)
- **Next:** [ADR0016](ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md) — Glue MCP surface and dual-surface orchestration (Mind vs Body).
