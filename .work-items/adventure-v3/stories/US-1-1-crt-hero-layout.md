# US-1-1 — CRT hero layout

## Epic

[E1 — CRT surface and playable game text](../epics/E1-crt-and-play.md)

## User story

**As a** demo viewer or player
**I want** the web shell to show a **large CRT-style game transcript** (hero panel) with command input **in the same visual system** as the working v1 dashboard
**so that** I immediately recognize “this is Colossal Cave” without reading debug panels

## Acceptance criteria (EARS)

- **WHEN** I open the v3 shell **THEN** I **SHALL** see a **dominant** transcript area using the same **layout class of metaphor** as [`adventure-nl`](../../adventure-nl/) (bezel/terminal, hero transcript — reference [`public/index.html`](../../adventure-nl/public/index.html) and [`dashboard.css`](../../adventure-nl/public/dashboard.css)).
- **WHEN** I have not yet sent a command **THEN** I **SHALL** not be required to scroll past **phase, reconcile, raw SSE, or trace** panels to find the game — those **SHALL** be absent from **first paint** or hidden behind an explicit **Advanced** disclosure (see [deferred.md](../deferred.md)).

## Notes

- Technical approach is intentionally unspecified here—this story is **UX acceptance**.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
