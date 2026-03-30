# adventure-llm source map

Human-oriented map of the TypeScript package: **file kinds**, **themes**, how **`public/`** lines up with **Vitest** under `src/`, optional future regrouping, and **which docs to touch** if paths move.

For system behavior and diagrams, see [../../docs/architecture/adventure-engine.md](../../docs/architecture/adventure-engine.md).

## Reorganization tier in use

**Tier 1 — documentation only:** this file and cross-links; no folder moves. Tiers 2–3 below are reference only for a future change.

---

## File-type taxonomy

| Kind                           | Where                                                        | Role                                                                               |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **TypeScript (library + CLI)** | `src/**/*.ts` (excluding `*.test.ts`, `*.dom.test.ts`)       | Node ESM; compiled to `dist/` via `tsconfig.json` (`rootDir: src`).                |
| **TypeScript tests**           | `**/*.test.ts`, `**/*.dom.test.ts`                           | Vitest; DOM suites use happy-dom.                                                  |
| **Browser ESM + types**        | `public/*.js`, matching `*.d.ts`                             | Dashboard UI; imported by `index.html` and tested from `src/` via `../public/...`. |
| **Static assets**              | `public/dashboard.css`, `public/sound/`, `public/index.html` | Presentation and audio.                                                            |
| **Node scripts**               | `scripts/*.mjs`, JSON fixtures under `scripts/`              | Experiments and codegen (not part of `tsc` `include`).                             |
| **Config / tooling**           | `package.json`, `eslint.config.js`, `.env.example`, Husky    | Build, lint, env documentation.                                                    |

---

## Theme-based modules

Layers match [adventure-engine.md](../../docs/architecture/adventure-engine.md): **simulation core** (dat + Fortran) vs **presentation/input** (NL, web, imagery).

### 1. Game data (`adventure.dat`)

- **Folder:** `src/dat/`
- **Files:** `loadDat.ts`, `types.ts`, `motionGraphFromDat.ts` (+ tests)
- **Theme:** Parse/load DAT, typed rows, motion graph derived from data.

### 2. Fortran engine integration (“oracle”)

- **Folder:** `src/engine/`
- **Files:** `subprocessEngine.ts`, `nativeEngine.ts`, `constants.ts` (+ tests)
- **Theme:** Spawn `./adventure`, stream I/O, scripted GETIN lines; optional native binding path.

### 3. GETIN vocabulary and token utilities

- **Folder:** `src/vocab/`
- **Files:** `vocab.ts`, `verbSynonymGroups.ts` (+ tests)
- **Theme:** KTAB/ATAB indexing, synonym groups for NL snapping.

### 4. Game text helpers (non-LLM)

- **Folder:** `src/text/`
- **Files:** `speak.ts` (+ test)
- **Theme:** Formatting / walking L-line chains, help text.

### 5. Natural language and LLM stack

- **Folder:** `src/nl/` with subfolder `src/nl/providers/`
- **Sub-themes (all under `nl/` today):**
  - **Contract + pipeline:** `textLlmContract.ts`, `textLlmInterpretPipeline.ts`, `adventureTextLlm.ts`, `schema.ts`, `coerceLlmJson.ts`, `coerceToVocab.ts`, `repairInterpreted.ts`, `jsonFromLlmText.ts`, `intent.ts`, `diagonalCompassMotion.ts`
  - **Providers:** `googleGenerativeAiTextLlm.ts`, `httpOpenAiCompatibleTextLlm.ts`, `mlxLmStdioTextLlm.ts`
  - **Prompts + experiments:** `adventureNlPrompts.ts`, `promptExperiment.ts`, `vocabHint.ts`, `interpretEvalFixtures.ts`, `interpretEvalMatch.ts`, `vocabCategoriesGenerate.ts`
  - **Autoplay / session / map inference:** `autoplaySessionMemory.ts`, `inferredExplorationMap.ts`, `explorationGraphViz.ts`, `situationalCandidates.ts`, `gameVocabEnums.ts`, `geminiAutoplay.ts`
  - **Gemini-specific (legacy + models):** `gemini.ts`, `geminiModels.ts`
  - **Caching + debug:** `interpretCacheKey.ts`, `interpretDiskCache.ts`, `llmDebug.ts`, `llmErrors.ts`
  - **Web dashboard model presets (server-driven):** `httpWebPresets.ts`, `textLlmWebPresetsConfig.ts`, `textLlmWebBackends.ts`, `googleWebModelPresets.ts`, `mlxModelPresets.ts`

### 6. Location imagery

- **Folder:** `src/images/`
- **Files:** `locationImages.ts` (+ test)
- **Theme:** Optional image generation/cache for locations.

### 7. CLI and HTTP server

- **Folder:** `src/cli/`
- **Files:** `main.ts`, `getin.ts`, `autoplayRunner.ts`, `webDashboard.ts`, `webDashboardGeneration.ts`, `promptProjectsStore.ts` (+ tests)
- **Theme:** Interactive CLI, autoplay runner, dashboard HTTP + SSE, prompt lab plumbing.

### 8. Public API surface

- **File:** `src/index.ts`
- **Theme:** Re-exports from dat, engine, vocab, text, nl, cli, images.

### 9. Web dashboard client + paired tests

**Runtime (`public/`):** `app.js`, `dashboardApi.js`, `dashboardState.js`, `dashboardEventStream.js`, `dashboardEnv.js`, `dashboardElementRefs.js`, `dashboardWidgets.js`, `transcriptView.js`, `mapView.js`, `promptLab.js`, plus shared modules `sseJson.js`, `autoplayPace.js`, `transcriptLayoutLogic.js`, `terminalTyper.js`.

**Tests (at `src/` root today):** Vitest imports the browser modules with relative paths such as `../public/<module>.js`.

| `public/` module           | Test file under `src/`             |
| -------------------------- | ---------------------------------- |
| `sseJson.js`               | `sseJson.test.ts`                  |
| `autoplayPace.js`          | `autoplayPace.test.ts`             |
| `transcriptLayoutLogic.js` | `transcriptLayoutLogic.test.ts`    |
| `dashboardApi.js`          | `dashboardApi.test.ts`             |
| `dashboardState.js`        | `dashboardState.test.ts`           |
| `dashboardEventStream.js`  | `dashboardEventStream.dom.test.ts` |
| `terminalTyper.js`         | `terminalTyper.dom.test.ts`        |

Server-side HTTP for the same dashboard is covered by `src/cli/webDashboard.test.ts`.

---

## Optional future regrouping (not applied)

1. **Tier 1 — documentation only** — This file; no import changes.
2. **Tier 2 — group dashboard-related tests** — e.g. `src/dashboard-client/` with imports adjusted to `../../public/...`; update README/architecture lines that mention `src/**/*.dom.test.ts` or specific paths.
3. **Tier 3 — split `nl/`** — e.g. `nl/pipeline/`, `nl/prompts/`, `nl/autoplay/`; updates every internal import and `index.ts` re-exports; sweep ADRs and architecture docs in one batch.

---

## If you move or rename `src/` or `public/` files

Grep and update as needed:

| Area               | Examples                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**   | `docs/architecture/adventure-engine.md`, `docs/architecture/overview.md`, `docs/architecture/adventure-fortran-engine.md` |
| **ADRs**           | `docs/decisions/ADR0001-adventure-llm-text-llm-providers.md`, `ADR0002`, `ADR0003`                                        |
| **Guidelines**     | `guidelines/adventure-llm/autoplay-planner-context.md`                                                                    |
| **Package README** | `adventure-llm/README.md`                                                                                                 |
| **This map**       | `adventure-llm/docs/source-map.md`                                                                                        |
| **Work items**     | `.work-items/adventure-llm/design.md`, related task markdown                                                              |
| **Root docs**      | `README.md`, `CONTRIBUTING.md`, `API_DOCUMENTATION.md`                                                                    |

ADRs are historical: update **relative links** when code moves; add a dated note only if the narrative would mislead.

Also update non-doc references: imports, `src/index.ts`, any `scripts/*.mjs` that resolve to moved paths.
