# ADR0014: Two-step migration of NL/SLM glue—extract package, then browser

## Context

### Problem

[ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) correctly places **browser-orchestrated** autoplay and **client-owned glue state** in the target architecture, and it distinguishes **Fortran + `adventure.dat` authority** (server-side simulation) from **inferred / policy state** (client-side). That ADR does not, by itself, define a **concrete, staged migration** for the **large body of backend TypeScript** that implements **SLM/LLM-facing cognition outside the DAT file**: interpret matching, repair of interpreted commands, situational candidates, vocabulary hints and categories, text helpers, and the **decision logic that switches modes** (e.g. search vs act vs explore vs pick-up) and **steers the next cognitive state for the model**. That code is **not** the parsed game database; it is the **glue** that consumes streamed text and structured signals to build prompts and planner context.

Without an explicit plan, work risks **copy-pasting** modules into the browser, **duplicating** behavior between Node and the bundle, or **ambiguous boundaries** between “packaging” ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)), “subsystem user code” ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)), and **core NL glue**.

### Relationship to other decisions

- **This ADR operationalizes the “glue moves client-side” scope** of ADR0005 for the **`adventure-llm` NL / vocab / text layers**, not the Fortran engine or full `loadDatFile` semantics in the browser.
- **[ADR0009](ADR0009-tdd-promote-gate-subsystems.md)** governs **user-authored subsystems** and promotion to live; **core NL glue** migration uses the same **TDD discipline** but is **not** the same artifact as subsystem SQLite revisions.
- **Sample modules** (illustrative of the class of code in scope—not an exhaustive closure list):  
  [`adventure-llm/src/vocab`](../../adventure-llm/src/vocab/),  
  [`adventure-llm/src/text`](../../adventure-llm/src/text/),  
  [`adventure-llm/src/nl/interpretEvalMatch.ts`](../../adventure-llm/src/nl/interpretEvalMatch.ts),  
  [`adventure-llm/src/nl/repairInterpreted.ts`](../../adventure-llm/src/nl/repairInterpreted.ts),  
  [`adventure-llm/src/nl/situationalCandidates.ts`](../../adventure-llm/src/nl/situationalCandidates.ts),  
  [`adventure-llm/src/nl/vocabAiCategories.ts`](../../adventure-llm/src/nl/vocabAiCategories.ts),  
  [`adventure-llm/src/nl/vocabHint.ts`](../../adventure-llm/src/nl/vocabHint.ts).  
  A **full inventory** (every file and dependency edge) should be produced as part of Phase A deliverables or a linked work item.

## Decision

Adopt a **two-step** migration for **NL/SLM glue** (interpretation helpers, situational and vocab pipelines, mode/heuristic policy that is not DAT authority):

1. **Phase A — Consolidate in a dedicated package (still Node)**  
   Move and **re-home** the glue modules into a **single, explicit package** (or workspace project) with a **clear public API** and **minimal, documented dependencies** (e.g. no accidental CLI or `webDashboard` imports from glue internals). The package remains **executed under Node and Vitest** for development and CI. Existing dashboard/server code **consumes the package** via stable entry points; **behavior is unchanged** aside from file layout and import paths (structural-first commits per project TDD policy).

2. **Phase B — Run that package from the browser**  
   Consume the **same** glue package (or a **browser build** of it, e.g. bundled ES modules) from the **browser orchestration** path ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md): XState machine / orchestrator), wired to SSE + logical LLM HTTP as already decided. **Tests:** keep **pure-function** tests on glue in the shared package; add **integration** tests with mocked LLM HTTP as in ADR0005/ADR0009 guidance.

**Ordering is mandatory:** Phase A completes (package boundary + green tests + consumers updated) before Phase B treats the browser as the primary runtime for that code.

## Alternatives considered

- **Direct “move `src/nl/` into the bundle” without Phase A** — Rejected: obscures the dependency graph, encourages partial duplication, and makes CI and reviews harder than a clean package boundary first.

- **Leave glue in `adventure-llm/src/nl/` indefinitely and only fork for browser** — Rejected: permanent two copies of mode/situational/interpret logic violate DRY on **knowledge**, not just lines.

- **Single monolithic step (extract + browser in one change)** — Rejected: violates small-batch delivery; hard to review and to bisect when behavior shifts.

## Consequences

**Positive**

- A **named seam** (“glue package”) makes ownership, versioning, and testing obvious.
- Phase A is **deployable** without changing where the browser runs—reduces risk.
- Aligns implementation with ADR0005’s intent: **glue** is a portable library, not an implicit pile of imports under `cli/`.

**Negative**

- **Two touches** to the same code (move to package, then wire browser); requires discipline to avoid feature work during migration.
- Package design mistakes in Phase A (wrong exports or hidden coupling) slow Phase B; mitigate with **strict entry points** and **dependency lint** (or documented rules) for the new package.

## Rationale

Authors and maintainers asked for an explicit distinction between **DAT-backed simulation** and **SLM/LLM decision glue**, and for a **refactor-friendly** path: **extract**, **stabilize**, **then** migrate runtime to the client. The two-step approach matches trunk-based, small-batch delivery and keeps a **green** Node test suite through Phase A.

## Status

Proposed

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — Browser-orchestrated cognition; glue vs engine/DAT boundary.
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — Backend packaging for logical LLM requests; glue package must not absorb vendor wire details.
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — TDD / promote gate for **subsystems**; glue package tests follow the same **discipline**, separate artifact.
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md) — User subsystem sandbox; **core glue package** is **not** user subsystems but may define **hooks** consumed by orchestration.
- [`docs/architecture/adventure-llm-cognition-and-workspace.md`](../architecture/adventure-llm-cognition-and-workspace.md) — Direction-of-travel overview.
- [`docs/decisions/adventure-llm-cognition-adr-index.md`](adventure-llm-cognition-adr-index.md) — Ordered ADR index for this program.
