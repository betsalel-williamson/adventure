# ADR0014: Two-step migration of NL/SLM glue—extract package, then browser

## Context

### Problem

[ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) correctly places **browser-orchestrated** autoplay and **client-owned glue state** in the target architecture, and it distinguishes **Fortran + `adventure.dat` authority** (server-side simulation) from **inferred / policy state** (client-side). That ADR does not, by itself, define a **concrete, staged migration** for the **large body of backend TypeScript** that implements **SLM/LLM-facing cognition outside the DAT file**: interpret matching, repair of interpreted commands, situational candidates, vocabulary hints and categories, text helpers, and the **decision logic that switches modes** (e.g. search vs act vs explore vs pick-up) and **steers the next cognitive state for the model**. That code is **not** the parsed game database; it is the **glue** that consumes streamed text and structured signals to build prompts and planner context.

Without an explicit plan, work risks **copy-pasting** modules into the browser, **duplicating** behavior between Node and the bundle, or **ambiguous boundaries** between “packaging” ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)), “subsystem user code” ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)), and **core NL glue**.

### Relationship to other decisions

- **This ADR operationalizes the “glue moves client-side” scope** of ADR0005 for the **`adventure-llm` NL / vocab / text layers**, not the Fortran engine or full `loadDatFile` semantics in the browser.
- **[ADR0009](ADR0009-tdd-promote-gate-subsystems.md)** governs **user-authored subsystems** and promotion to live; **core NL glue** migration uses the same **TDD discipline** but is **not** the same artifact as subsystem SQLite revisions.
- **Package location (Phase A, in repo):** [`adventure-llm/packages/nl-glue`](../../adventure-llm/packages/nl-glue/) — npm name **`@adventure-llm/nl-glue`**, built before the main package (`npm run build` / `check`). Entry point: [`packages/nl-glue/src/index.ts`](../../adventure-llm/packages/nl-glue/src/index.ts).

### Inventory (backend review — glue vs stays server)

**A. Already in `@adventure-llm/nl-glue` (move is done for these; keep tests and exports in sync):**

| Area | Files under `packages/nl-glue/src/` |
| ---- | ----------------------------------- |
| Schema / contracts | `schema.ts` |
| DAT-shaped types | `dat/types.ts` |
| Vocab | `vocab/vocab.ts`, `vocab/verbSynonymGroups.ts`, `gameVocabEnums.ts` |
| Text | `text/speak.ts` |
| Motion / enums | `diagonalCompassMotion.ts` |
| Interpret / repair | `interpretEvalMatch.ts`, `repairInterpreted.ts` |
| Situational / loot / candidates | `situationalCandidates.ts` |
| Vocab hints / AI categories | `vocabHint.ts`, `vocabAiCategories.ts` |

**B. Phase A — still under `adventure-llm/src/nl/` (glue; target move into `@adventure-llm/nl-glue` before Phase B):**

These implement **inferred map / intent / visualization / coercion** and broader **session + planner** glue over transcript and `AdventureDatabase` — not Fortran I/O, not vendor LLM wire format.

| Category | Files |
| -------- | ----- |
| **Map / exploration / viz** | [`inferredExplorationMap.ts`](../../adventure-llm/src/nl/inferredExplorationMap.ts), [`explorationGraphViz.ts`](../../adventure-llm/src/nl/explorationGraphViz.ts) |
| **Intent / vocab coercion** | [`intent.ts`](../../adventure-llm/src/nl/intent.ts), [`coerceToVocab.ts`](../../adventure-llm/src/nl/coerceToVocab.ts) |
| **Session memory + planner path** | [`autoplaySessionMemory.ts`](../../adventure-llm/src/nl/autoplaySessionMemory.ts), [`autoplayPlannerGuards.ts`](../../adventure-llm/src/nl/autoplayPlannerGuards.ts), [`plannerToScriptedGetin.ts`](../../adventure-llm/src/nl/plannerToScriptedGetin.ts), [`buildAutoplayPlannerInvocation.ts`](../../adventure-llm/src/nl/buildAutoplayPlannerInvocation.ts) |
| **Prompts + JSON shaping** | [`adventureNlPrompts.ts`](../../adventure-llm/src/nl/adventureNlPrompts.ts), [`jsonFromLlmText.ts`](../../adventure-llm/src/nl/jsonFromLlmText.ts), [`coerceLlmJson.ts`](../../adventure-llm/src/nl/coerceLlmJson.ts), [`promptExperiment.ts`](../../adventure-llm/src/nl/promptExperiment.ts) |
| **Interpret pipeline glue** | [`textLlmInterpretPipeline.ts`](../../adventure-llm/packages/nl-glue/src/textLlmInterpretPipeline.ts) |
| **Shared types** | [`textLlmContract.ts`](../../adventure-llm/src/nl/textLlmContract.ts) (or fold into package `schema` / exports after review) |
| **Fixtures / codegen helpers** | [`interpretEvalFixtures.ts`](../../adventure-llm/src/nl/interpretEvalFixtures.ts), [`vocabCategoriesGenerate.ts`](../../adventure-llm/src/nl/vocabCategoriesGenerate.ts) — may stay in `adventure-llm` if only scripts/tests need them; otherwise co-locate with glue tests |

**C. Shim / pipe (stay in `adventure-llm` until Phase B; thin adapters, not duplicate glue):**

| Location | Role |
| -------- | ---- |
| [`src/cognition/dashboardServerLlmReactions.ts`](../../adventure-llm/src/cognition/dashboardServerLlmReactions.ts) | Server-side “reactions” to LM output; should **call** `@adventure-llm/nl-glue` (and moved modules from B), not reimplement them |
| [`src/pipe/gameSimulationPipe.ts`](../../adventure-llm/src/pipe/gameSimulationPipe.ts) | Documents the Fortran/game pipe vs glue boundary |
| [`src/browser/shims/`](../../adventure-llm/src/browser/shims/) | Browser bundle shims (e.g. `vocabAiCategories.browser.ts`) until Phase B consumes the package directly |

**D. Explicitly *not* in the glue package (remain Node/server; [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) packaging, pools, env):**

| Area | Files / dirs |
| ---- | ------------ |
| LLM **providers** | `src/nl/providers/*` |
| **HTTP / dashboard presets** | `httpWebPresets.ts`, `mlxModelPresets.ts`, `googleWebModelPresets.ts`, `textLlmWebPresetsConfig.ts`, `textLlmWebBackends.ts` |
| **Orchestration → LLM** | `adventureTextLlm.ts` (facade over providers + packaging) |
| **Packaging profile** | `llmPackagingProfile.ts`, `llmPackagingConstants.ts` |
| **Vendor / cloud** | `gemini.ts`, `geminiAutoplay.ts`, `geminiModels.ts` |
| **Node I/O** | `interpretDiskCache.ts` (filesystem cache), `interpretCacheKey.ts` / `interpretCacheKeyMaterial.ts` (disk cache keys; pipe-level, not glue package), `llmDebug.ts` |
| **CLI / dashboard** | `autoplayThrottle.ts` (may stay server-adjacent), `src/cli/*` except imports |

**E. Integration tests that need `adventure.dat` / `loadDatFile`:** [`src/test/nl-glue/*.test.ts`](../../adventure-llm/src/test/nl-glue/) (plus [`src/vocab/*.test.ts`](../../adventure-llm/src/vocab/), etc.) — they import `@adventure-llm/nl-glue` but live **outside** the package so **`npm run deps:phase-a`** can enforce zero app-tree imports from `packages/nl-glue/src`. Pure unit tests remain under [`packages/nl-glue/src/**/*.test.ts`](../../adventure-llm/packages/nl-glue/src/).

**Closure rule:** Any new file under **`src/nl/`** that only depends on **`AdventureDatabase` + transcript + glue types** (no `node:fs` except via injectable adapters, no provider SDKs) belongs in **`@adventure-llm/nl-glue`** or **`src/cognition/`** as a thin caller — not a third copy of the same logic.

## Decision

Adopt a **two-step** migration for **NL/SLM glue** (interpretation helpers, situational and vocab pipelines, mode/heuristic policy that is not DAT authority):

1. **Phase A — Consolidate in a dedicated package (still Node)**  
   Use **`@adventure-llm/nl-glue`** ([`packages/nl-glue`](../../adventure-llm/packages/nl-glue/)) as that package: extend **`index.ts` exports** as modules from **Inventory §B** move in. **Re-home** all glue listed there (including **`inferredExplorationMap`**, **`intent`**, **`explorationGraphViz`**, **`coerceToVocab`**, and the rest of table **B**) so **`src/nl/`** retains only **server adapters**, **providers**, and **presets** (see **§D**). The package keeps a **clear public API** and **minimal dependencies** (e.g. no accidental CLI or `webDashboard` imports from glue internals). It runs under **Node and Vitest** in CI. Existing app code **consumes** it via stable entry points; **behavior is unchanged** aside from layout and imports (structural-first commits per project TDD policy).

   **Phase A architectural goal:** the **backend** toward the Fortran game should be a **simple pipe** (send input to the simulation, stream or return game output). **Reactions to LM responses**—turning model JSON into GETIN lines, repair/swap, planner context, vocab/situational hints—live in **`@adventure-llm/nl-glue`** and **`adventure-llm/src/cognition/`** (server-side shims until Phase B), not inlined in HTTP routing. The dashboard HTTP layer coordinates sessions and I/O; it should call into cognition/glue rather than embedding interpretation logic.

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

- [`adventure-llm/packages/nl-glue`](../../adventure-llm/packages/nl-glue/) — **`@adventure-llm/nl-glue`** implementation and `package.json` workspaces entry.
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — Browser-orchestrated cognition; glue vs engine/DAT boundary.
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — Backend packaging for logical LLM requests; glue package must not absorb vendor wire details.
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — TDD / promote gate for **subsystems**; glue package tests follow the same **discipline**, separate artifact.
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md) — User subsystem sandbox; **core glue package** is **not** user subsystems but may define **hooks** consumed by orchestration.
- [`docs/architecture/adventure-llm-cognition-and-workspace.md`](../architecture/adventure-llm-cognition-and-workspace.md) — Direction-of-travel overview.
- [`docs/decisions/adventure-llm-cognition-adr-index.md`](adventure-llm-cognition-adr-index.md) — Ordered ADR index for this program.
