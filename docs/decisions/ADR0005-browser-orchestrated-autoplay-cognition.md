# ADR0005: Browser-orchestrated autoplay cognition loop

## Context

### User needs and motivations

- **Researchers and power users** want to **change how the game is driven** (memory, heuristics, prompt structure, interaction modes) **without** redeploying or restarting the Node dashboard.
- **Developers** want a clear split: the backend runs the **game binary** and **model connections**; the **policy and glue** that interpret streamed text and decide the next command live where they can be iterated quickly (browser) and versioned (subsystem store — see other ADRs).

### Technical context

Today `runAutoplaySessionWithTextLlm` in `autoplayRunner.ts` orchestrates Fortran I/O, **glue-layer** TypeScript (`AutoplaySessionMemory`, inferred exploration map, situational candidates, planner guards, mode/prompt wiring), and LLM calls in one Node process. That couples iteration speed to server lifecycle.

**What “cognition” means here (scope):**

- **In scope to move client-side:** the **glue code** built on top of game output — not the Fortran simulation and not the raw `adventure.dat` as the authority for “what the game world is.” Concretely, this includes (today mostly in `adventure-llm/src/nl/`): **directed / inferred graph map**, **inventory heuristics**, **spatial or XYZ-style map reasoning** where present, **rules for switching modes** (e.g. move vs search vs act), object-hint scoping, stagnation/oscillation guards, and any similar **derived state and policy** that turns transcript + history into planner context and the next GETIN.
- **Explicitly not the goal:** shipping a full **parsed game database** (`adventure.dat` / `loadDatFile` semantics) to the browser so the client “runs” the same data layer as Node. Parser vocabulary and dat-backed features may remain server-side for packaging and validation ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)); the **behavioral glue** that consumes **text the server already streams** should live in client JavaScript with **client-authoritative state** for that glue.

**Game truth vs inferred truth:** The server/Fortran process is **authoritative** for simulation. The client maintains an **observer’s mental model** (inferred map, heuristics, modes). Tests should treat glue as **pure logic** over transcript slices where possible, decoupled from engine I/O.

**Extra network hop:** The path adds **SSE (server → client)** for game text, then **HTTP (client → server)** for each logical LLM call. **LLM time-to-first-token** usually dominates; still, avoid **chatty** cognitive substeps on the hot path. Prefer a **single long-lived** HTTP connection (keep-alive / same session). **Batching** multiple logical requests into one HTTP call is only viable when the work is independent or explicitly designed as a single packaged request ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)); many agentic steps are **sequential by nature** — see risks below.

## Decision

- Move the **orchestration loop** for the web dashboard to the **browser**: a state machine that consumes **streamed game text** (SSE), updates **client-side glue state** (map, inventory model, modes, prompts), builds **logical** LLM requests, sends GETIN via session APIs, and calls packaging-backed LLM endpoints ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)).
- Keep **Fortran subprocess**, **`adventure.dat` beside the binary**, and **SSE** delivery on the server; do not move the `adventure` binary to WASM in this program.

## Alternatives considered

- **Keep full orchestration on the server** — Rejected for web UX goals (dynamic policy changes without restart); may remain for CLI (`cli/main.ts`) until explicitly migrated.
- **WebWorker-only cognition** — Deferred: same logical split as main thread; can migrate later for heavy work.
- **Replicate full dat / parser state in the browser as the primary migration** — Rejected as the defining approach; it confuses **game content loading** with **glue policy**. If the client needs token lists or constraints for prompts, expose them via small, intentional APIs ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)), not by mirroring the entire dat loader as the centerpiece of ADR0005.
- **`sessionStorage` / `localStorage` as the durable store for cognitive glue state** — Rejected as **source of truth** (see **Risk A** mitigations and implementation guidance): isolation per tab, volatility on close, and ~5MB limits break multi-tab workspace, durability, and growth. Acceptable only for **ephemeral UI** (e.g. panel toggles), not map/inventory/mode state.

## Consequences

**Positive**

- Subsystem and glue edits can affect the next move without Node reload.
- **Pure-function testability:** Glue behavior can be tested as **pure functions** over transcript slices and explicit state, decoupled from the Fortran binary and from network I/O — fast feedback in the test runner.
- **Single locus of control** for orchestration in the dashboard path (the browser), avoiding **two masters** (client and server both driving transitions).
- Clear seam for integration tests: mock **SSE** and **logical LLM** HTTP ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)).

**Negative (operational)**

- Larger client bundle; more client-side state to debug.
- **Migration work:** existing Node modules (`autoplaySessionMemory`, inferred map, situational candidates, etc.) become **reference implementations** to port or thinly wrap on the client, not something to keep permanently duplicated without a plan.

**Risks and required mitigations**

| Risk                             | Description                                                                                                                                                                                                                             | Mitigation (required before production)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — State rehydration (“F5”)** | Refresh kills the tab; Fortran may still be mid-game. A new tab sees SSE text but **blank** inferred map / inventory / modes. Replaying the **entire** transcript to rebuild glue blows token limits and latency.                       | **Client state checkpointing:** persist inferred cognitive state (map, inventory model, mode, cursor) to the **durable client store** on each turn — aligned with **client-authoritative SQLite WAL** ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)) and **OPFS / IndexedDB**, not `sessionStorage` as source of truth. On reconnect: **hydrate from SQLite**, then request only a **transcript diff** (or bounded tail) from the server, not a full replay. Define reconnect semantics explicitly (engine session id vs glue revision). |
| **B — Desync death spiral**      | Glue infers “I have the lamp” from text/LLM; Fortran disagrees. The loop may repeat doomed commands forever.                                                                                                                            | Extend **stagnation / oscillation guards** (already in scope) with an explicit **resync policy:** after _N_ failures or repeated rejection patterns, force **ground-truth probing** commands (e.g. `INVENTORY`, `LOOK`) and treat parser/engine rejection lines as **hard corrections** to inferred state.                                                                                                                                                                                                                                          |
| **C — Sequential LLM latency**   | Many cognitive steps cannot be parallelized; step 2 often depends on step 1. Batching into one HTTP call without a purpose-built packaged request implies a **server-side mini-orchestrator**, which conflicts with moving policy here. | **Acknowledge** sequential network hops where unavoidable. Keep the UI responsive with **explicit progress signals** from the client loop (e.g. `updating map`, `planning next move`, `calling model`) so pauses are legible — not silent hangs.                                                                                                                                                                                                                                                                                                    |

## Implementation guidance (non-normative)

- **Formal state machine:** Prefer a **state machine library** (e.g. **XState**) for the async orchestration loop (SSE chunks, LLM calls, errors, manual pause) instead of ad-hoc `switch`/`boolean` soup — visualization and transition guards pay off as complexity grows.
- **SSE contract:** Do not rely solely on **regex over raw text** to detect “prompt ready.” Define **deterministic server → client events** (e.g. a named SSE event when the engine is blocked on GETIN / stdin idle), so the client machine has a **clear trigger** to advance planning. Document the contract beside `webDashboard` / SSE handlers.
- **Testing the browser loop:** Use **MSW (Mock Service Worker)** (or equivalent) to intercept **logical LLM** HTTP calls in tests so orchestration tests never hit real provider endpoints by accident. Keep **unit tests** on pure glue functions separate from MSW integration tests.
- **TDD on glue:** State transitions, mode switches, map/inventory updates from **synthetic or recorded transcript snippets**, without the full dat file unless a test explicitly requires it.
- **Minimal server contract:** Stream text; accept GETIN; apply [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) for model calls. Name **client-owned glue state** so it is never confused with engine truth.
- **Storage choice:** **Do not** use `sessionStorage` or `localStorage` as the **authoritative** store for cognitive glue (map, inventory, modes, transcript-sized history). Use **OPFS / IndexedDB–backed SQLite** (and cross-tab access patterns) as in [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md), [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md). `sessionStorage` may still be used for **ephemeral UI** only (e.g. which panel is open).
- **SharedWorker / DB locking:** A **single connection owner** (e.g. `SharedWorker`) for SQLite across Dashboard and Workspace tabs is specified in those ADRs; **ADR0005 does not redefine** that mechanism — implement cross-tab DB access per [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) and [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) to avoid split-brain and lock contention.

### Forward work: XState / actor-centric orchestration (ties to ADR0006+)

**Intent:** Use **XState** (or the same event/actor discipline) as the **single hub** for dashboard **action → reaction** flows: engine SSE (e.g. `getin_prompt_ready`, `transcript_delta`), **logical LLM** phases (`POST /api/autoplay-plan`), GETIN submission, **UI progress** signals (ADR0005 risk C), and—once landed—**persistence** and **cross-cutting events** from later ADRs.

| Concern                      | How an actor-style model helps                                                                                                                                                                     | Linked ADRs                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Durable glue checkpoints** | Transitions can **invoke** “persist snapshot” after a committed turn; state survives refresh when SQLite hydrate completes ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) risk A). | [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)          |
| **Replay / time travel**     | Subsystem **files** at R are materialized via the store ([ADR0007](ADR0007-subsystem-revision-control-and-replay.md) **Implementation**). Record **events** (not only snapshots) for full fidelity “same cognition sequence” replay. | [ADR0007](ADR0007-subsystem-revision-control-and-replay.md)      |
| **Sync lifecycle**           | **Sync pending / complete / fork** become explicit states or deferred actors—not ad-hoc flags. **Server** path: **`POST /api/subsystem-sync`** ([ADR0008](ADR0008-server-subsystem-replica-and-sync.md) **Implementation**). **Browser** must still invoke it and wire results into the actor. | [ADR0008](ADR0008-server-subsystem-replica-and-sync.md)          |
| **Promote gate**             | **Promoted** revision → `reload live hooks` event into the same machine (or child actor).                                                                                                          | [ADR0009](ADR0009-tdd-promote-gate-subsystems.md)                |
| **Workspace ↔ dashboard**    | **`BroadcastChannel`** messages translate to machine events (hot reload after promote).                                                                                                            | [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) |
| **Subsystem sandbox**        | Privileged orchestrator **sends** typed messages; sandbox **returns** results—same mental model as `postMessage`, aligns with [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md).          | [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)       |

**As-built today:** a minimal **`browserAutoplayCognitionMachine`** (XState v5) exists under `adventure-llm/src/browser/autoplayCognitionMachine.ts` (unit-tested); the live **`browserAutoplayOrchestrator.js`** path is still **imperative** and should **converge** on driving (or embedding) that machine so LLM prompt assembly, guards, and engine I/O are not scattered. Optional **Stately Inspector** (or `actor.subscribe` logging) for dev builds only—see [`docs/architecture/adventure-llm-cognition-and-workspace.md`](../architecture/adventure-llm-cognition-and-workspace.md). **In-dashboard** orchestration visibility is specified in [ADR0013](ADR0013-dashboard-xstate-cognition-panel.md) (third card in the map column, distinct from Session FSM Mermaid).

## Rationale

**Policy and glue** (how we interpret output and assemble the next step) belong with fast iteration and subsystem versioning in the browser. **Engine I/O and secrets** stay server-side. **Game data files** stay with the binary; **glue** is driven by **observed text**, not by re-hosting the full dat pipeline in the browser as the main deliverable of this ADR. Bounded context: Fortran + packaging on server; orchestration + inferred model in the client.

## Status

Proposed

## References

- `adventure-llm/src/cli/autoplayRunner.ts` (CLI / optional server-orchestrated web path)
- `adventure-llm/src/cli/webDashboard.ts`, `browserEngineBridge.ts`, `engineGetinQueue.ts`
- `adventure-llm/src/browser/autoplayCognitionMachine.ts`, `cognitionBundle.ts` (esbuild → `public/generated/`)
- `adventure-llm/public/browserAutoplayOrchestrator.js` (client loop; to align with XState machine)
- `adventure-llm/src/nl/autoplaySessionMemory.ts` (glue: turn log, heuristics, inferred map inputs)
- `adventure-llm/src/nl/inferredExplorationMap.ts`, `explorationGraphViz.ts` (graph / map glue)
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) — client SQLite subsystem store (schema + API **implemented**; browser WASM/OPFS + optional glue tables **forward work** — see ADR **Implementation**)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) — replay semantics with cognition (subsystem tree at R + tags/revert in store — see ADR **Implementation**; typed event replay and UI forward work)
- [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) — server replica + **`POST /api/subsystem-sync`** (see ADR0008 **Implementation**); sync may include glue rows in client DB when those tables exist
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — tests + MSW before promote
- [ADR0010](ADR0010-monaco-workspace-second-tab-cross-tab-sync.md) — second tab, `BroadcastChannel`, SharedWorker note
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)
- [ADR0012](ADR0012-optional-ts-transpile-subsystem-authoring.md)
