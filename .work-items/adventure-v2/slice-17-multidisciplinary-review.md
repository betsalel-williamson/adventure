# Slice 17 multidisciplinary review — Web shell modularity + UX clarity

**Scope:** `adventure-v2/apps/web` refactor (smaller modules), UX queue **U3**–**U5**, new Vitest coverage.

## UX / product

- **U3 — Oracle mode + stub autoplay messaging:** Intro copy states that **oracle behavior is determined by the API process** (synthetic vs process vs Fortran), not the browser. **Stub autoplay** carries a `title` tooltip clarifying **deterministic commands, not an LLM**. Reduces the P0/P1 expectation gaps called out in [`ux-multidisciplinary-review-prep.md`](./ux-multidisciplinary-review-prep.md) §3.
- **U4 — Raw SSE default / persistence:** Checkbox defaults **off** in markup; **`shellUiPreferences`** restores the last choice so benchmark operators can keep SSE on without forcing that default on first-time visitors (addresses P2 “raw SSE defaults on”).
- **U5 — Game lane empty state:** Shared **`GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER`** plus **`appendGameTerminalVirtualLine`** removes the placeholder when the first **`oracle_observation`** chunk arrives; user echo and `[agent]` lines can stack above oracle output while the wait banner remains until oracle text lands.

**Decision prompts (prep §4):** Persona, Fortran-as-default demo, and model-selection UX remain **explicitly deferred** — no ADR change in this slice.

## Architecture

- **Single responsibility:** Diagram/Mermaid concerns live in **`agentDiagramPanel.ts`**; checkpoint HTTP shape in **`runCheckpointsApi.ts`**; game-lane text rules in **`gameTerminalBuffer.ts`**; cross-session UI toggles in **`shellUiPreferences.ts`**.
- **`main.ts`** remains the wiring layer for bootstrap, SSE, and session snapshot persistence — shorter and easier to navigate than embedding diagram + fetch logic inline.

## Security

- No new server endpoints or secrets. **`shellUiPreferences`** and existing session persistence remain **client-only `localStorage`** (same trust boundary as slice 14–16 shell persistence).
- Tooltip and copy changes do not expose internal host paths beyond existing README references.

## Operations / reliability

- **Offline restore:** Unchanged flow — snapshot restore + optional SSE error message when API unreachable.
- **Regression risk:** Checkpoint listing behavior preserved via shared **`fetchRunCheckpoints`** (unit-tested with mocked `fetch`).

## Testing evidence

- **`npm test`** (Vitest) in `adventure-v2/`: all tests passing, including **`gameTerminalBuffer.test.ts`**, **`shellUiPreferences.test.ts`**, **`runCheckpointsApi.test.ts`**.

## Follow-ups

- **U6** when server honors configurable **`RunConfig`** fields end-to-end.
- Optional **E2E** (Playwright) when shell flows stabilize — aligns with README **Not yet**.
