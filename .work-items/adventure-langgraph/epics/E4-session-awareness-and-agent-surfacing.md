# Epic E4 — Session awareness and honest agent surfacing

## Objective

Users see **what was noticed** from the live session (transcript and simple structured signals), with copy and layout that cannot be mistaken for **full autonomy**—the assistant **senses** first; the player **acts**.

## Scope

- An **ancillary** panel or region for **session signals** derived from play (see stories).
- Plain-language **assistance posture**: what mode is active and what it will or will not do.

## Dependencies

- **E1** and **E2** baseline so the CRT shell and trust signals exist.
- **E3** remains optional for scripted multi-turn demos.

## Operating posture glossary (planning / UX copy)

**Terminology:** **Operating posture** and **assistance posture** refer to the same concept here—epics and deferred items use “operating”; user-facing stories say “assistance.” Everyday labels below are what users see.

These labels map **internal** decision-making style (inspired by the Cynefin sense-making framework) to **user-facing** wording. User stories use everyday language only.

| Intent | Example user-facing label | Behavior note |
| --- | --- | --- |
| Low-friction suggestions | Quick assist | Small steps; changes obvious before the next assist |
| Confirm before changing anything | Study first | Explicit confirmation for actions that alter drafts or suggestions |
| Preview only | Dry run | No applying assists beyond agreed preview rules |
| Recovery / minimal noise | Stabilize | Fewer suggestions until the session looks grounded |

## Stories

| ID | Link |
| --- | --- |
| US-4-1 | [Session signals visible](../stories/US-4-1-session-signals-visible.md) |
| US-4-2 | [Operating posture visible](../stories/US-4-2-operating-posture-visible.md) |
| US-4-3 | [User chooses assistance posture](../stories/US-4-3-user-chooses-assistance-posture.md) |

## Out of scope

- Draft location graph as the primary deliverable (see [E5](E5-draft-world-picture-map-assist.md)).
- Mandatory orchestration or cognition traces on the hero CRT (see [deferred.md](../deferred.md)).

## Navigation

[epics/index.md](index.md) · [index.md](../index.md)
