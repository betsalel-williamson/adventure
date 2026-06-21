# Overview

Play Colossal Cave with **natural-language commands** and a local **autoplay research dashboard** — transcript, inferred map, and session panels over SSE.

## How it works

TypeScript tooling parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and optionally maps free-form text to GETIN-safe parser tokens via Gemini, MLX, or OpenAI-compatible HTTP backends.

**NL** means **natural language**, not a vendor name. Shared interpret/planner glue ships as **`@adventure-nl/nl-glue`** (`packages/nl-glue/`).

![Autoplay web dashboard](../docs/adventure-nl-dashboard.png)

Play guide: [`docs/client/nl/quick-start.md`](../docs/client/nl/quick-start.md)
