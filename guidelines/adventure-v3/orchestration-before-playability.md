# Title

Building orchestration (graphs, state machines) before the game is playable in-product.

## Problem

We invested in **LangGraph** and **XState** to impose structure on agentic control and to escape **hard-coded glue** from an earlier stack. The runtime gained traces, phases, and reconcile semantics, but the **default user interface** became an **engineering dashboard**. Users and demos expected **Colossal Cave output in a terminal-like surface** (as in **`adventure-nl`’s CRT transcript**). Instead, the **game lane was secondary**; synthetic oracle defaults and sparse oracle text made the experience look **broken** unless operators read deep README material. The **purpose of playing the game** was lost behind the “ideal” system.

## Solution

For the next version line, **invert the order**:

1. Ship a **thin backend** that streams **Fortran/game text** reliably and a **frontend whose layout and styling match the proven v1 CRT dashboard** ([`adventure-nl/public/index.html`](../../adventure-nl/public/index.html), [`dashboard.css`](../../adventure-nl/public/dashboard.css)).
2. Treat **orchestration frameworks** as **optional depth** behind a **game-first** shell, not as the default surface.
3. Name **autoplay modes** so they cannot be mistaken for an intelligent agent when they are **deterministic or stubbed**.

## Impact

Avoids repeating a cycle where **architecture diagrams** satisfy reviewers while **non-engineers** conclude the product “does not run Adventure.” Preserves the Fortran binary as the **hero artifact** and restores **trust** before layering cognition.

## Takeaways

- **Usefulness before sophistication:** the smallest useful increment is **human-readable game output** in a familiar CRT surface — not a new control framework. If a milestone does not change what an end user **sees or does**, defer it.
- **Game transcript parity before graph parity:** if `./adventure` output is not primary in the UI, the stack is mis-prioritized for this product.
- **Synthetic oracle is for tests, not demos:** default human paths should show **real room text** or an unmistakable **“game not wired”** state.
- **Structured agents need thin seams:** extract **oracle I/O + transcript sink** first; expand control theory after the demo path works.

## References

Sharded epics and user stories: [`.work-items/adventure-v3/index.md`](../../.work-items/adventure-v3/index.md).
