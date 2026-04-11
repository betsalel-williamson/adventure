# ADR0014: Two-step migration of NL/SLM glue—extract package, then browser

## Context

### Problem

[ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) correctly places **browser-orchestrated** autoplay and **client-owned glue state** in the target architecture, and it distinguishes **Fortran + `adventure.dat` authority** (server-side simulation) from **inferred / policy state** (client-side). That ADR does not, by itself, define a **concrete, staged migration** for the **large body of backend TypeScript** that implements **SLM/LLM-facing cognition outside the DAT file**: interpret matching, repair of interpreted commands, situational candidates, vocabulary hints and categories, text helpers, and the **decision logic that switches modes** (e.g. search vs act vs explore vs pick-up) and **steers the next cognitive state for the model**. That code is **not** the parsed game database; it is the **glue** that consumes streamed text and structured signals to build prompts and planner context.

Without an explicit plan, work risks **copy-pasting** modules into the browser, **duplicating** behavior between Node and the bundle, or **ambiguous boundaries** between “packaging” ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)), “subsystem user code” ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)), and **core NL glue**.

### Relationship to other decisions

- **This ADR operationalizes the “glue moves client-side” scope** of ADR0005 for the **`adventure-nl` NL / vocab / text layers**, not the Fortran engine or full `loadDatFile` semantics in the browser.
- **[ADR0009](ADR0009-tdd-promote-gate-subsystems.md)** governs **user-authored subsystems** and promotion to live; **core NL glue** migration uses the same **TDD discipline** but is **not** the same artifact as subsystem SQLite revisions.
- **Package location (Phase A, in repo):** [`adventure-nl/packages/nl-glue`](../../adventure-nl/packages/nl-glue/) — npm name **`@adventure-nl/nl-glue`**, built before the main package (`npm run build` / `check`). Entry point: [`packages/nl-glue/src/index.ts`](../../adventure-nl/packages/nl-glue/src/index.ts).

### Inventory (glue vs server — after Phase A + Phase B)

**A. In `@adventure-nl/nl-glue` (`packages/nl-glue/src/`):** All **portable** NL/SLM glue (interpretation helpers, situational and vocab pipelines, inferred map/exploration viz, intent/coercion, session memory, planner invocation and guards, prompts, JSON coercion, `TextLlm` contract types, interpret pipeline, fixtures loaders, vocab category codegen). Authoritative export list: [`packages/nl-glue/src/index.ts`](../../adventure-nl/packages/nl-glue/src/index.ts). Original §A + former §B modules from the ADR draft now live here.

**B. Phase B — browser consumes the same package (bundled ESM):** The dashboard loads [`public/generated/browserAutoplayCognition.js`](../../adventure-nl/public/generated/browserAutoplayCognition.js) (built from [`src/browser/cognitionBundle.ts`](../../adventure-nl/src/browser/cognitionBundle.ts) via [`scripts/bundle-browser-cognition.mjs`](../../adventure-nl/scripts/bundle-browser-cognition.mjs)). The orchestrator dynamic-imports that URL from [`public/browserAutoplayOrchestrator.js`](../../adventure-nl/public/browserAutoplayOrchestrator.js). **dependency-cruiser** enforces that only `cognitionBundle.ts` may import `packages/nl-glue` from `src/browser/` (see [`adventure-nl/.dependency-cruiser.cjs`](../../adventure-nl/.dependency-cruiser.cjs)).

**C. Shim / pipe (thin adapters in `adventure-nl`; not duplicate glue):**

| Location | Role |
| -------- | ---- |
| [`src/cognition/dashboardServerLlmReactions.ts`](../../adventure-nl/src/cognition/dashboardServerLlmReactions.ts) | Server-side “reactions” to LM output; **calls** `@adventure-nl/nl-glue` |
| [`src/pipe/gameSimulationPipe.ts`](../../adventure-nl/src/pipe/gameSimulationPipe.ts) | Documents the Fortran/game pipe vs glue boundary |
| [`src/browser/shims/interpretEvalFixtures.browser.ts`](../../adventure-nl/src/browser/shims/interpretEvalFixtures.browser.ts) | Esbuild alias: no fixture disk reads in the browser bundle |
| [`src/browser/shims/vocabAiCategories.browser.ts`](../../adventure-nl/src/browser/shims/vocabAiCategories.browser.ts) | Esbuild alias: no filesystem AI vocab cache in the bundle (API-compatible stub) |

**D. Explicitly *not* in the glue package (remain Node/server; [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) packaging, pools, env):**

| Area | Files / dirs |
| ---- | ------------ |
| LLM **providers** | `src/nl/providers/*` |
| **HTTP / dashboard presets** | `httpWebPresets.ts`, `mlxModelPresets.ts`, `googleWebModelPresets.ts`, `textLlmWebPresetsConfig.ts`, `textLlmWebBackends.ts` |
| **Orchestration → LLM** | `adventureTextLlm.ts` (facade over providers + packaging) |
| **Packaging profile** | `llmPackagingProfile.ts` (shared constants live in `@adventure-nl/nl-glue`, e.g. `llmPackagingConstants.ts`) |
| **Vendor / cloud** | `gemini.ts`, `geminiAutoplay.ts`, `geminiModels.ts` |
| **Node I/O** | `interpretDiskCache.ts` (filesystem cache), `interpretCacheKey.ts` / `interpretCacheKeyMaterial.ts` (disk cache keys; pipe-level, not glue package), `llmDebug.ts` |
| **CLI / dashboard** | `autoplayThrottle.ts` (may stay server-adjacent), `src/cli/*` except imports |

**E. Integration tests that need `adventure.dat` / `loadDatFile`:** [`src/test/nl-glue/*.test.ts`](../../adventure-nl/src/test/nl-glue/) (plus [`src/vocab/*.test.ts`](../../adventure-nl/src/vocab/), etc.) — they import `@adventure-nl/nl-glue` but live **outside** the package so **`npm run deps:phase-a`** can enforce zero app-tree imports from `packages/nl-glue/src`. Pure unit tests remain under [`packages/nl-glue/src/**/*.test.ts`](../../adventure-nl/packages/nl-glue/src/).

**Closure rule:** Any new file under **`src/nl/`** that only depends on **`AdventureDatabase` + transcript + glue types** (no `node:fs` except via injectable adapters, no provider SDKs) belongs in **`@adventure-nl/nl-glue`** or **`src/cognition/`** as a thin caller — not a third copy of the same logic.

## Decision

Adopt a **two-step** migration for **NL/SLM glue** (interpretation helpers, situational and vocab pipelines, mode/heuristic policy that is not DAT authority):

1. **Phase A — Consolidate in a dedicated package (still Node)**  
   Use **`@adventure-nl/nl-glue`** ([`packages/nl-glue`](../../adventure-nl/packages/nl-glue/)) as that package: extend **`index.ts` exports** so all portable glue from **Inventory §A** lives there, and **`src/nl/`** retains only **server adapters**, **providers**, and **presets** (see **§D**). The package keeps a **clear public API** and **minimal dependencies** (e.g. no accidental CLI or `webDashboard` imports from glue internals). It runs under **Node and Vitest** in CI. Existing app code **consumes** it via stable entry points; **behavior is unchanged** aside from layout and imports (structural-first commits per project TDD policy).

   **Phase A architectural goal:** the **backend** toward the Fortran game should be a **simple pipe** (send input to the simulation, stream or return game output). **Reactions to LM responses**—turning model JSON into GETIN lines, repair/swap, planner context, vocab/situational hints—live in **`@adventure-nl/nl-glue`** and **`adventure-nl/src/cognition/`** (server-side thin callers), not inlined in HTTP routing. The dashboard HTTP layer coordinates sessions and I/O; it should call into cognition/glue rather than embedding interpretation logic.

2. **Phase B — Run that package from the browser**  
   Consume the **same** glue package as a **browser build** (bundled ESM) from the **browser orchestration** path ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md): XState machine / orchestrator), wired to SSE + logical LLM HTTP as already decided. **Tests:** keep **pure-function** tests on glue in the shared package; browser-side unit tests cover the cognition machine (`src/browser/*.test.ts`); broader **integration** tests with mocked LLM HTTP remain per ADR0005/ADR0009 guidance.

**Ordering (as shipped):** Phase A landed first (package boundary + green tests + consumers updated); Phase B adds the **esbuild** browser bundle and orchestrator dynamic import **without** maintaining a second source copy of glue logic.

## Alternatives considered

- **Direct “move `src/nl/` into the bundle” without Phase A** — Rejected: obscures the dependency graph, encourages partial duplication, and makes CI and reviews harder than a clean package boundary first.

- **Leave glue in `adventure-nl/src/nl/` indefinitely and only fork for browser** — Rejected: permanent two copies of mode/situational/interpret logic violate DRY on **knowledge**, not just lines.

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

## Implementation

**Location (package [`adventure-nl`](../../adventure-nl/)):**

| Area | Path |
| ---- | ---- |
| **`@adventure-nl/nl-glue`** (tsc → `dist/`, public API) | [`adventure-nl/packages/nl-glue/`](../../adventure-nl/packages/nl-glue/) |
| Browser bundle **entry** (re-exports glue + dat JSON + throttle + cognition machine) | [`adventure-nl/src/browser/cognitionBundle.ts`](../../adventure-nl/src/browser/cognitionBundle.ts) |
| **esbuild** browser build (`public/generated/browserAutoplayCognition.js`) | [`adventure-nl/scripts/bundle-browser-cognition.mjs`](../../adventure-nl/scripts/bundle-browser-cognition.mjs) |
| Orchestrator: `import()` of generated bundle, SSE + `/api/autoplay-*` | [`adventure-nl/public/browserAutoplayOrchestrator.js`](../../adventure-nl/public/browserAutoplayOrchestrator.js) |
| Minimal XState cognition machine (extensible toward ADR0005 hub) | [`adventure-nl/src/browser/autoplayCognitionMachine.ts`](../../adventure-nl/src/browser/autoplayCognitionMachine.ts) |
| **dependency-cruiser** (glue reachable from `src/browser/` only via bundle entry) | [`adventure-nl/.dependency-cruiser.cjs`](../../adventure-nl/.dependency-cruiser.cjs) |
| **`npm run build`** chain (glue `tsc`, app `tsc`, then browser bundle) | [`adventure-nl/package.json`](../../adventure-nl/package.json) `"build"` script |

**Session wiring:** `GET /api/session` exposes **`browserOrchestratedAutoplay`** (historical name: “browser drives the self-acting loop”). When **`true`**, `public/app.js` loads `browserAutoplayOrchestrator.js`, which dynamic-imports **`/generated/browserAutoplayCognition.js`** and runs **nl-glue** on **`getin_prompt_ready`**. The dashboard server does **not** reimplement that glue—it forwards **`/api/autoplay-plan`** to the text-model pool and runs the Fortran engine. **`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY` defaults to client-side NL** (unset → browser bundle); set to **`0`** / **`false`** / **`no`** / **`off`** to run the same glue **in Node** (legacy parity with the CLI runner).

**Forward work (not closed by this ADR):** richer orchestration events, glue checkpointing to SQLite per [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) / [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md), integration tests with mocked LLM HTTP at the orchestrator boundary, and driving **`browserAutoplayCognitionMachine`** from the orchestrator (currently exported from the bundle but the imperative `wireBrowserAutoplayOrchestrator` path owns the loop).

## Status

Accepted

## References

- [`adventure-nl/packages/nl-glue`](../../adventure-nl/packages/nl-glue/) — **`@adventure-nl/nl-glue`** implementation and `package.json` workspaces entry.
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — Browser-orchestrated cognition; glue vs engine/DAT boundary.
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — Backend packaging for logical LLM requests; glue package must not absorb vendor wire details.
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — TDD / promote gate for **subsystems**; glue package tests follow the same **discipline**, separate artifact.
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md) — User subsystem sandbox; **core glue package** is **not** user subsystems but may define **hooks** consumed by orchestration.
- [`docs/architecture/adventure-nl-cognition-and-workspace.md`](../architecture/adventure-nl-cognition-and-workspace.md) — Direction-of-travel overview.
- [`docs/decisions/adventure-nl-cognition-adr-index.md`](adventure-nl-cognition-adr-index.md) — Ordered ADR index for this program.
