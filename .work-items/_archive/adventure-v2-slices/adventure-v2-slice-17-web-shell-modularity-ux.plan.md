# Adventure v2 — Slice 17: Web shell modularity + UX clarity (U3–U5)

## Objective

Reduce duplication and oversized modules in `apps/web` while closing UX prep queue steps **U3**–**U5** ([`ux-multidisciplinary-review-prep.md`](../../ux-multidisciplinary-review-prep.md) §5): oracle-mode messaging, persisted raw-SSE toggle, and a stable game-lane placeholder until first oracle output.

## Technical design

- **Pure terminal buffer** (`gameTerminalBuffer.ts`): central placeholder string and append helper keyed by chunk kind (`user_echo` | `proposal` | `oracle` | `meta`) so TDD can lock behavior without DOM.
- **Checkpoint fetch** (`runCheckpointsApi.ts`): single `fetchRunCheckpoints` replaces three inline `fetch`/`json` blocks in `main.ts`.
- **Diagram panel** (`agentDiagramPanel.ts`): Mermaid init, bundled/custom diagrams, and localStorage wiring moved out of `main.ts`.
- **UI prefs** (`shellUiPreferences.ts`): separate `localStorage` key from session snapshot for **Show raw SSE log** (default off; last choice restored).
- **`main.ts`**: orchestration, SSE, REST turns, persistence — imports the modules above.

## Tasks (TDD order)

1. **Red**: Vitest for `appendGameTerminalVirtualLine`, `shellUiPreferences`, `fetchRunCheckpoints`.
2. **Green**: Implement modules; refactor `main.ts` + `index.html`; README one-line note on SSE prefs.
3. **Refactor**: Keep `main.ts` free of duplicated checkpoint parsing and diagram setup.

## Exit criteria

- All Vitest tests green (`npm test` in `adventure-v2/`).
- UX prep **U3**–**U5** behaviors implemented (copy, SSE toggle persistence, oracle placeholder lifecycle).
- Multidisciplinary review note filed (`slice-17-multidisciplinary-review.md`).

## Out of scope

- **U6** run-config UI (blocked on ModelAdapter).
- **U7** map visualization.
- Automated Playwright for the browser shell.
