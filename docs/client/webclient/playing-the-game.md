# Playing the game

How the **CRT transcript** surface behaves from your perspective as a player.

## What you see

- Oracle game text in a fixed-width **CRT viewport** (80×24 character metaphor)
- Your commands echoed on the same scroll buffer as room output
- A **status strip** with plain-language connection and oracle health when enabled

The hero panel stays primary — side panels must not hide readable game text.

## What you do

Type a parser command and press Enter — your echo and the oracle response appear in the transcript.

If the game API is unreachable, you see a clear status message instead of a blank screen.

## Authority

Room descriptions and parser responses come from the **Fortran oracle**. Anything in side panels (maps, hints, agent traces) is **draft assistance** unless labeled otherwise.

Shared term: [CRT transcript](../../glossary/crt-transcript.md) · [Oracle](../../glossary/oracle.md)

## Production surfaces today

Until the webclient CRT is fully migrated, play on:

- **adventure-langgraph** — [Quick start (langgraph)](../quick-start.md)
- **adventure-nl dashboard** — [NL quick start](../nl/quick-start.md)

Product detail: [Features — CRT transcript](../../features/webclient/crt-transcript.md)
