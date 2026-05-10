# AP-3-2 — Tell hint from game world

## Epic

[AP3 — Trust and honest labels](../epics/AP3-trust-and-honest-labels.md)

## User persona

See [persona.md](../persona.md) — **Agent builder Avery**.

## User story

**As an** agent builder Avery
**I want** **assistive text**, **draft suggestions**, and **game transcript** to be **visually and linguistically distinct**
**so that** I never treat a **hint** or **draft** as **authoritative room or parser output** from the adventure

## Acceptance criteria (EARS)

- **WHEN** the game shows **room or parser output** from the adventure **THEN** that content **SHALL** read as **the game**—not as my assistant’s commentary, unless the product explicitly blends them with clear marking.
- **WHEN** the product shows **hints**, **drafts**, or **suggestions** **THEN** I **SHALL** see them **marked or styled** so they **cannot** be mistaken for **canonical transcript** from the world.
- **IF** both appear **near** each other **THEN** I **SHALL** still be able to **tell which is which** at a glance.

## Success metrics (verifiable)

- Review or tests confirm **distinction** holds for default authoring/play surfaces referenced by this work item.

## Notes

- Implementers align boundary details with [design-agentic-mvp.md](../../adventure-v3/design-agentic-mvp.md); stories remain **user-observable** only.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
