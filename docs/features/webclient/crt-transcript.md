# CRT transcript

The **CRT transcript** is the hero webclient panel: oracle game text and an inline command line in a fixed-width viewport.

## Behavior

- **Viewport** — 80×24 character metaphor; transcript and prompt share one scroll buffer
- **Input** — parser commands submitted on Enter; echo formatted as `> COMMAND`
- **Scroll** — tail-follow on new oracle lines
- **Status** — optional strip reports API and oracle health in plain language

## Game backends

The webclient routes transcript I/O through a **game backend adapter**:

| Backend | Delivers oracle text via |
| ------- | ------------------------ |
| `v2-http` | adventure-v2 `POST /runs`, SSE `/runs/:id/events` |
| `nl-dashboard` | adventure-nl dashboard REST + SSE `/events` |
| `mock` | Static fixture for UI-only work |

## Feature flag

`crtTranscript` — default **on** in webclient.

## Design constraint

Command input and room text stay on the hero CRT. Side panels are ancillary and flag-gated.

User guide: [Client — playing the game](../../client/webclient/playing-the-game.md) · Glossary: [CRT transcript](../../glossary/crt-transcript.md)

Legacy production shell: [CRT shell](../crt-shell.md)
