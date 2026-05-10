# v3 planning — overview

## Objective

Ship a **human-facing** Colossal Cave experience again: **game text first**, **CRT-style shell** aligned with [`adventure-nl`](../../adventure-nl/), before any advanced orchestration UI.

## Status

**CRT-first MVP shipped** in-repo: [`adventure-v3/README.md`](../../adventure-v3/README.md) documents the shell talking to the adventure-v2 HTTP + SSE API with honest status and wire tests. Planning docs ([epics/index.md](epics/index.md), [stories/](stories/)) track **what end users see next**.

**Next phase (queue):** optional **ancillary** surfaces—session awareness, assistance posture, draft location picture—under **E4** and **E5**, without displacing the hero transcript (see [guidelines/adventure-v3/orchestration-before-playability.md](../../guidelines/adventure-v3/orchestration-before-playability.md)).

## Rule (non-negotiable)

**Usefulness before sophistication.** A milestone counts only if it changes what an **end user** can **see or do** (transcript, input, honest errors, clear status). Internal architecture is supporting material, not the definition of done.

## Audience

- **Primary:** implementers prioritizing the next shippable slice.
- **Secondary:** reviewers tracing epics → stories → acceptance criteria.

## Terms (this planning folder)

- **Hero CRT / CRT transcript:** the main game surface—readable Adventure output plus command input—not diagram or trace panels.
- **Ancillary:** optional UI beside the hero CRT (session signals, posture, draft map); never replaces the transcript as the primary surface.

## References

Visual baseline for “v1-style” UX: [`adventure-nl/public/index.html`](../../adventure-nl/public/index.html), [`adventure-nl/public/dashboard.css`](../../adventure-nl/public/dashboard.css).

## Navigation

Return to [index.md](index.md).
