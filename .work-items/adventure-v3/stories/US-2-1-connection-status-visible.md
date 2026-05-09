# US-2-1 — Connection / game readiness visible

## Epic

[E2 — Trust and clarity](../epics/E2-trust-and-clarity.md)

## User story

**As a** visitor
**I want** a **single obvious status line** that states whether the shell is connected to the **real game**
**so that** I do not need the README to answer “is this actually Adventure?”

## Acceptance criteria (EARS)

- **WHEN** the shell loads **THEN** I **SHALL** see **one compact status indicator** (e.g. under the title or on the CRT bezel) reporting game/oracle readiness in **plain language**.
- **WHEN** the backend uses the **Fortran process** path **THEN** the status **SHALL** reflect that (wording TBD in implementation, but **not** jargon-only).
- **WHEN** the game cannot be reached **THEN** the status **SHALL** show **not ready** (or equivalent) **together with** the error surfacing from [US-1-2](US-1-2-real-game-or-clear-failure.md).

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
