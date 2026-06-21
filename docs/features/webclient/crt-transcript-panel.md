# CRT transcript panel

The **CRT transcript panel** is the hero surface: oracle game text and an inline command line in a fixed-width viewport.

## Source implementations

### adventure-langgraph (product direction)

| Aspect | Detail |
| ------ | ------ |
| **Paths** | `adventure-langgraph/apps/web/index.html`, `src/main.ts`, `src/transcript/buffer.ts`, `src/wire/virtualTerminal.ts` |
| **Viewport** | 80×24 character metaphor |
| **Input** | `#command-input` on same scroll buffer as transcript |
| **Game backend** | adventure-v2 HTTP + SSE (`POST /runs`, `POST /runs/:id/turns`, `EventSource /runs/:id/events`) |
| **Feature flag (webclient)** | `crtTranscript` (default **on**) |

Scroll behavior: tail-follow on new oracle lines; command echo formatted as `> COMMAND`.

### adventure-nl (research dashboard)

| Aspect | Detail |
| ------ | ------ |
| **Paths** | `adventure-nl/public/index.html`, `public/transcriptView.js`, `public/terminalTyper.js` |
| **Layout** | Center column hero; optional classic vs terminal transcript layout (`?transcript=`) |
| **Game backend** | Embedded dashboard server (`webDashboard.ts`) — Fortran subprocess in-process |
| **Extra chrome** | Autoplay log stream, manual interpret, CRT control deck below hero |

## Webclient migration notes

**Target:** `adventure-webclient/apps/web/#crt-transcript-panel`

**Adapter:** `VITE_WEBCLIENT_GAME_BACKEND`:

- `v2-http` — port langgraph `api/client.ts` + SSE wiring
- `nl-dashboard` — port `dashboardApi.js` + `/events` SSE
- `mock` — static transcript for pure UI iteration

**Do not migrate yet:** NL-specific autoplay log split (keep under `autoplayControls` flag).

## Acceptance (when migrated)

- WHEN I type a parser command and press Enter THEN I SHALL see my echo and oracle response in the CRT viewport
- WHEN the game API is unreachable THEN I SHALL see plain-language status on the strip, not a blank screen
- WHILE `crtTranscript` is off THEN the hero panel SHALL be hidden without breaking other flagged panels

## Related docs

- [LangGraph CRT shell](../crt-shell.md) — current production shell
- [Feature catalog](feature-catalog.md)
- [Webclient dev setup](../../developer/webclient-dev-setup.md)
