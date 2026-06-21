# Overview

TypeScript tooling for Colossal Cave Adventure: parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and adds optional **natural language** (NL) mapping — turning what you type at `>` into GETIN-safe tokens — with optional Gemini and other **text-model** backends.

**NL** means **natural language**, not a vendor name. Shared interpret/planner glue ships as **`@adventure-nl/nl-glue`** (`packages/nl-glue/`).

![Autoplay web dashboard](../../docs/adventure-nl-dashboard.png)
