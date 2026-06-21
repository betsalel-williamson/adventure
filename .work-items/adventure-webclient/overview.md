# adventure-webclient — overview

## Problem

Frontend work is split across two packages with different stacks and no shared flag registry:

- **adventure-langgraph** — TypeScript CRT shell, Mermaid exploration map (incomplete migration off monolithic main)
- **adventure-nl** — mature autoplay dashboard (vanilla ES modules) with rich research panels

Backend systems (v2 HTTP, LangGraph assist, AG2, NL glue) evolve faster than any single UI package. Without a dedicated client layer, UI experiments require running the wrong backend or duplicating panels.

## Goal

Build **adventure-webclient** as the single place to:

1. **Preserve** existing UI investments via documentation + incremental port
2. **Explore** panels and visuals through feature flags
3. **Test** agent backends independently of presentation code

## Principles

- **Game-first CRT** stays hero — ancillary panels are flag-gated (same as langgraph deferred policy)
- **Honest labeling** when runs use stubs, heuristics, or draft maps
- **Backend adapters** — game, assist, and agent targets selected by env, not import graph
- **One feature at a time** — each panel gets a docs shard before or alongside code migration
- **Do not delete sources** until webclient flag path reaches parity and tests pass

## Success metrics

- Developer can run webclient on port 5175 with only the panels they need
- Feature catalog lists every panel with migration status
- Same shell can target LangGraph assist or AG2 stub via `VITE_WEBCLIENT_ASSIST_BACKEND`
- CRT + v2 adapter enables agent backend testing without NL dashboard chrome

## Out of scope (initial phases)

- Replacing adventure-langgraph or adventure-nl packages wholesale
- New agent orchestration logic (lives in assist/ag2/nl packages)
- Playwright E2E (until shell stabilizes)
