# Slice 18 multidisciplinary review — Fortran / oracle game-terminal lane

**Scope:** Ensure **`#game-terminal`** always consumes **`oracle_observation`** SSE turns when the formatted oracle text is empty (whitespace-only **`output`**), so the wait placeholder clears and Fortran/process demos cannot appear “stuck” with no oracle line.

## UX / product

- **Observable fix:** The CRT lane now runs the same append path for **`oracle_observation`** whether the formatted line is non-empty room text or **`""`** after trailing-whitespace trim (edge case for whitespace-only oracle **`output`**).
- **Turn ordering (`submitTurn`):** The API completes **`POST /turns`** only after it has emitted SSE (**proposal → traces → oracle**). User echo was previously appended **after** `await fetch`, so the lane often read **`[agent]` · oracle · `> cmd`**. Viewers stared at the scroll tail and saw only **`>`**, with room/Fortran text scrolled above — reported as “no game output.” Echo is now appended **before** `fetch`, and **`#game-terminal`** scrolls to the bottom on each append so the latest line stays in view.
- **Fortran path unchanged at the server:** Scenario **C** in [`ux-multidisciplinary-review-prep.md`](./ux-multidisciplinary-review-prep.md) §1 still requires **`ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs`** and a built **`./adventure`** — the shell cannot show Fortran if the API is on the default synthetic oracle ([`adventure-v2/README.md`](../../adventure-v2/README.md) Fortran table).

## Architecture

- **Single mapping function:** **`gameTerminalTurnAppendFromWire`** in [`apps/web/src/gameTerminalBuffer.ts`](../../adventure-v2/apps/web/src/gameTerminalBuffer.ts) centralizes “does this **`SseWireEvent`** append to the game lane?” using **`formatVirtualTerminalWireChunk`** → **`null`** for reconcile/checkpoint-style turns, non-null **`string`** (including **`""`**) for proposal/oracle.
- **`main.ts`** delegates to that helper so **`handleWireData`** does not reimplement **`chunkKind`** rules or accidentally treat **`""`** as falsy.

## Security

- No new endpoints, env vars, or **`localStorage`** keys. Parsing still uses existing **`parseSseWirePayload`** / contracts schemas.

## Operations / reliability

- **Regression:** `npm test` and `npm run test:cucumber` under **`adventure-v2/`** pass; server/oracle subprocess code untouched (no **`npm run test:oracle-fortran`** requirement for this slice).

## Testing evidence

- **`tests/gameTerminalBuffer.test.ts`:** Whitespace-only oracle maps to **`""`** but **`gameTerminalTurnAppendFromWire`** returns **`oracle`**; **`appendGameTerminalVirtualLine`** clears **`GAME_TERMINAL_AWAITING_ORACLE_PLACEHOLDER`**; reconcile wires yield **`null`**; echo-before-proposal-before-oracle ordering is asserted on the buffer helpers.

## Follow-ups

- **[Prep P0]** In-UI oracle mode indicator remains backlog (synthetic vs Fortran vs process).
- Optional **Playwright** when shell flows stabilize ([`adventure-v2/README.md`](../../adventure-v2/README.md) **Not yet**).
