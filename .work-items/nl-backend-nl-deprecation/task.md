> **GitHub:** [#36–#39](https://github.com/betsalel-williamson/adventure/issues?q=is%3Aissue+label%3Aprogram%3Anl-backend-nl-deprecation) · **Status:** deferred · Track in GitHub + manifest.

# Tasks: Deprecate server-forward NL (phased, TDD)

Work is **sequential**; each step leaves the repo in a green state. Follow **Red → Green → Refactor** per [process-03-development.mdc](../../.cursor/rules/process-03-development.mdc).

## Phase A — Intent locked in docs (complete when merged)

- [x] Architecture and ADRs state **client-direct** cognition for dashboard default path ([ADR0015](../../docs/decisions/ADR0015-deprecate-server-forward-nl-cognition.md), [`design.md`](./design.md), [`adventure-nl-cognition-and-workspace.md`](../../docs/architecture/adventure-nl-cognition-and-workspace.md)).
- [x] **`API_DOCUMENTATION.md`** describes legacy vs browser paths.

**Verification:** Reviewers can trace intent from ADR0015 → architecture doc → API doc without reading application code.

## Phase B — TDD guardrails (autoplay)

**Objective:** Automated proof that the **default browser orchestration path** does not call legacy planner endpoints.

- [ ] **Red:** Add a test (e.g. static analysis or Vitest that imports orchestrator source as text) asserting **`browserAutoplayOrchestrator.js`** contains no `postNlPlanner` / no `"/api/nl/planner"` string—or equivalent contract the team prefers.
- [ ] **Green:** Already satisfied if test passes after merge; if not, remove stray references only.
- [ ] **Refactor:** None unless test is brittle.

**Verification:** `npm test` in `adventure-nl/` passes.

## Phase C — Deprecation signal on legacy HTTP handlers

**Objective:** Callers of **`POST /api/nl/planner`** (if any) receive a machine-readable deprecation notice.

- [ ] **Red:** Extend `webDashboardNlHttpContract.test.ts` (or sibling) to expect **`Deprecation`** header and/or JSON field on successful planner response.
- [ ] **Green:** Implement in `webDashboard.ts` for planner (and stub interpret for same pattern when ready).
- [ ] Document in **`API_DOCUMENTATION.md`** under legacy routes.

**Verification:** Contract test passes; manual `curl` optional.

## Phase D — Browser interpret (mirror planner)

**Objective:** Manual NL uses **`interpretInBrowser`** (or analogous) instead of **`POST /api/nl/interpret`** for dashboard default.

- [ ] **Red:** Failing test describing desired behavior (e.g. app flow or unit test for interpret client module).
- [ ] **Green:** Implement browser interpret using same credential pattern as **`browserPlanner`**; wire **`app.js`**.
- [ ] Mark **`POST /api/nl/interpret`** legacy in docs + Phase C-style deprecation.

**Verification:** Manual NL E2E path works with **google**/**http**; MLX documented as server-orchestrated or interpret-via-server until bridged.

## Phase E — Optional removal

**Objective:** Remove or **`410 Gone`** legacy routes behind **`ADVENTURE_NL_ALLOW_LEGACY_NL_FORWARD`** (default **on** for one release, then **off**).

- [ ] **Red:** Tests for default **off** in dev CI when flag removed.
- [ ] **Green:** Gate routes on env; default conservative.
- [ ] Update **`API_DOCUMENTATION.md`** and release notes.

**Verification:** CI green; CLI still passes with flag on.

## Traceability

| Requirement | ADR / design |
|-------------|----------------|
| No dashboard default on server-forward NL | [ADR0015](../../docs/decisions/ADR0015-deprecate-server-forward-nl-cognition.md) |
| TDD discipline | [process-03](../../.cursor/rules/process-03-development.mdc), this `task.md` |
