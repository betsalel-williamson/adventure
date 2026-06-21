# Epic E5 — Draft world picture from play (map assist)

## Objective

Users obtain a **draft** picture of how locations relate—derived from descriptions and exploration during play—that they can **inspect**, **copy**, or **discard**, with labeling that makes **draft** status obvious.

## Scope

- A **reviewable** structured diagram or equivalent (implementation detail; see [design-agentic-mvp.md](../design-agentic-mvp.md)).
- Honest provenance: built from session text and user-visible inputs, not implied ground truth from the Fortran engine unless separately specified.

## Dependencies

- **E4** minimum viable **session awareness** ([US-4-1](../stories/US-4-1-session-signals-visible.md)); otherwise a map has no trustworthy grounding in what the user actually saw.

## Stories

| ID | Link |
| --- | --- |
| US-5-1 | [Draft location diagram reviewable](../stories/US-5-1-draft-location-diagram-reviewable.md) |

## Out of scope

- Authoritative automapping tied to `adventure.dat` internals without human review.
- Replacing the CRT transcript as the primary surface.

## Navigation

[epics/index.md](index.md) · [index.md](../index.md)
