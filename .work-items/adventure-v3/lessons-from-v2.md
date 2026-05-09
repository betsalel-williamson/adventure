# Lessons from adventure-v2

## Why v2 is set aside for “the demo”

**adventure-v2** produced valuable experiments (contracts, HTTP/SSE, subprocess oracle, LangGraph + XState), but **the default experience was not “play Colossal Cave.”** The UI elevated **wires, phases, traces, and diagrams** over **readable game text in one obvious surface**. That fails the end-user test no matter how tidy the architecture is.

We are **not** treating v2 as the path to a **human-facing** Adventure demo until the sharded milestones in [stories/](stories/) are met under a v3 line.

## Context: what v1 got right

**v1 (`adventure-nl`):** The Fortran binary plus `adventure.dat` stayed the simulation of truth. The **autoplay web dashboard** put a **CRT transcript** front and center ([`adventure-nl/public/index.html`](../../adventure-nl/public/index.html)) so demos **looked like Adventure** immediately.

**Pain:** Generalizing **agent glue** without hard-coding was hard—that motivated deeper orchestration work.

## Context: what went wrong in v2

**Orchestration overtook the game.** LangGraph and XState improved internal structure, but the **game lane** was one panel among many. **Synthetic oracle** defaults made the CRT feel **empty or broken** unless operators read the README. **Stub autoplay** was honest in code but easy to misread as “AI plays Adventure.”

## Navigation

- [index.md](index.md)
- [epics/index.md](epics/index.md)
