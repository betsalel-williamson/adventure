# v3 planning — overview

## Objective

Ship a **human-facing** Colossal Cave experience again: **game text first**, **CRT-style shell** aligned with [`adventure-nl`](../../adventure-nl/), before any advanced orchestration UI.

## Status

**CRT-first MVP shipped** in-repo: [`adventure-v3/README.md`](../../adventure-v3/README.md) documents the shell talking to the adventure-v2 HTTP + SSE API with honest status and wire tests. Planning docs ([epics/index.md](epics/index.md), [stories/](stories/)) track **what end users see next**.

**Next phase (queue):** **exploration map column** beside the hero CRT — a **draft** Mermaid directed graph of locations and compass moves, updated from visible play via a **background location agent** (line + transcript context → graph). **E4** ancillary UI (session signals, posture) remains **deferred** for the default surface; implementations stay **feature-flagged** for regression (see [`deferred.md`](deferred.md) and [`design-agentic-mvp.md`](design-agentic-mvp.md)).

## Rule (non-negotiable)

**Usefulness before sophistication.** A milestone counts only if it changes what an **end user** can **see or do** (transcript, input, honest errors, clear status). Internal architecture is supporting material, not the definition of done.

## Audience

- **Primary:** implementers prioritizing the next shippable slice.
- **Secondary:** reviewers tracing epics → stories → acceptance criteria.

## Terms (this planning folder)

- **Hero CRT / CRT transcript:** the main game surface—readable Adventure output plus command input—not diagram or trace panels.
- **Exploration map column:** optional beside-CRT **draft** Mermaid diagram of inferred places and compass edges; default product surface after the map reset.
- **Ancillary (legacy):** optional Assist panels (session signals, posture, probe, inspectors); **off by default** via feature flags.

## References

Visual baseline for “v1-style” UX: [`adventure-nl/public/index.html`](../../adventure-nl/public/index.html), [`adventure-nl/public/dashboard.css`](../../adventure-nl/public/dashboard.css).

## Navigation

Return to [index.md](index.md).
