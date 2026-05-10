# US-4-3 — User chooses assistance posture

## Epic

[E4 — Session awareness and honest agent surfacing](../epics/E4-session-awareness-and-agent-surfacing.md)

## User story

**As a** visitor
**I want** to **choose** the assistance posture before relying on the next assist step
**so that** behavior matches how cautious I feel about suggestions and previews.

## Acceptance criteria (EARS)

- **WHEN** I change posture **THEN** I **SHALL** see **confirmation of the new posture** before the next assist output that depends on it (visual change or equivalent compact acknowledgment).
- **WHEN** a posture change would leave an in-progress preview stale **THEN** I **SHALL** see **clear notice** that prior previews may no longer apply.
- **IF** only one posture is implemented initially **THEN** I **SHALL** still see it **named and explained** per [US-4-2](US-4-2-operating-posture-visible.md), with controls appearing as additional postures ship.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
