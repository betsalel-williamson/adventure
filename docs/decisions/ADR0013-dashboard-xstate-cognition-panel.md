# ADR0013: Third map-column panel for XState cognition display

## Context

### User needs and motivations

- **Developers and researchers** debugging **browser-orchestrated** autoplay need to see **orchestration state** (idle, planning, submitting, errors) at a glance—same motivation as **explicit progress signals** in [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) risk C.
- **Operators** should not have to open DevTools or run a separate inspector to answer: _where is the cognition loop right now?_ _what event last fired?_

### Technical context

The dashboard **map hero column** (`adventure-llm/public/index.html`, `.map-hero-column-body`) currently stacks **two** panels:

1. **Session FSM (Mermaid)** — session-learned **exploration graph** (directed edges, rejected moves, non-move actions); _game-derived_, not the autoplay orchestrator.
2. **Exploration map** — inferred **(x, y, z)** grid view of the same exploration model.

The **cognition orchestration** machine ([ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md))—`browserAutoplayCognitionMachine` and the imperative `browserAutoplayOrchestrator.js` path—is **orthogonal**: it sequences SSE, `POST /api/autoplay-plan`, GETIN submission, and (as integration completes) **client-driven** sync/promote/subsystem-store events from [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md), [ADR0007](ADR0007-subsystem-revision-control-and-replay.md), [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) (**`POST /api/subsystem-sync`** is implemented server-side; the browser actor still needs to invoke it), and [ADR0009](ADR0009-tdd-promote-gate-subsystems.md). That deserves its **own** visible surface so it is not confused with the **session exploration FSM**.

**Naming:** In UI copy, use labels such as **Cognition** / **Autoplay orchestration** / **Planner FSM**—never “Session FSM” for the XState panel, to avoid clashing with the existing Mermaid card.

## Decision

- Add a **third** `.panel` card in the **same** `.map-hero-column-body` stack (order **TBD in implementation**, e.g. Session FSM → **XState cognition** → Exploration map, or cognition between the two—choose for scroll ergonomics and visual priority).
- **Minimum viable display:** read-only **current state value**, optional **context** summary (sanitized: no secrets), and **last N transition labels** or a rolling event list, updated from `createActor(...).subscribe` or equivalent.
- **Visualization upgrade path:** optional **graph** rendering (e.g. Mermaid generated from the machine definition, or a small bundled graph helper) once the machine stabilizes; keep the **text snapshot** as fallback for accessibility and tests.
- **Scope gating:** When **`browserOrchestratedAutoplay`** is false ([`GET /api/session`](../../API_DOCUMENTATION.md)), the panel shows a **short disabled / not applicable** message rather than empty chrome.
- **Optional dev hook:** [Stately Inspector](https://stately.ai/docs/developer-tools) or similar **only** when explicitly enabled (e.g. env-injected flag for static build, or `localStorage` dev toggle)—never required for normal play; document bundle-size impact in implementation.

## Alternatives considered

- **Fold XState into the existing “Session FSM (Mermaid)” card** — Rejected: conflates **exploration graph** (game-inferred) with **orchestration** (planner/actor); different update rates and semantics confuse users.
- **Inspector-only (no in-dashboard panel)** — Rejected as primary: hurts discoverability; acceptable as an **additional** dev path.
- **Replace the exploration map with XState** — Rejected: both views are needed; exploration remains primary for spatial reasoning.
- **Modal / overlay only** — Deferred as default; a persistent panel matches the existing two-card pattern and keeps orchestration visible during play.

## Consequences

**Positive**

- Clear **separation of concerns** in the UI: exploration FSM vs grid vs **cognition** actor.
- Aligns dashboard affordances with [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) forward work (observable orchestration).
- Easier **manual QA** and demos without external tools.

**Negative**

- **Vertical scroll** in the map column increases; CSS may need tuning (existing `.map-hero-column-body` scroll behavior).
- **Bundle size** if graph or inspector dependencies ship to production; mitigate with lazy load and feature flags.

## Rationale

A **third** stacked panel reuses established layout and mental model (card + title + help). The cognition actor is a distinct subsystem from the session-learned graph; giving it a dedicated panel avoids misleading labels and supports the move toward **one orchestration hub** described in [`docs/architecture/adventure-llm-cognition-and-workspace.md`](../architecture/adventure-llm-cognition-and-workspace.md).

## Status

Proposed

## References

- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — browser orchestration, XState machine, Stately Inspector note
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) — subsystem SQLite store module (orchestration may surface head/promote-style events)
- [ADR0007](ADR0007-subsystem-revision-control-and-replay.md) — tags / replay-at-revision in store (orchestration may surface tag or revert events when wired)
- [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) — sync lifecycle (**HTTP** landed; display **sync pending / fork** when the actor invokes `POST /api/subsystem-sync`)
- [ADR0009](ADR0009-tdd-promote-gate-subsystems.md) — tests can assert transitions; panel aids manual verification
- `adventure-llm/public/index.html` — `.map-hero-column-body`, `.map-fsm-card`, `.map-hero`
- `adventure-llm/public/dashboard.css` — map column layout
- `adventure-llm/src/browser/autoplayCognitionMachine.ts` — machine to display
