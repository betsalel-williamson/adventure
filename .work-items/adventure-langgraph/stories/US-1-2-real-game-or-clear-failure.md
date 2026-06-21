# US-1-2 — Real game output or clear failure

## Epic

[E1 — CRT surface and playable game text](../epics/E1-crt-and-play.md)

## User story

**As a** player
**I want** each submitted command to produce **authentic game text** from the Fortran engine **or** an unmistakable on-screen explanation when that is impossible
**so that** I never mistake an empty screen or a terse **`OK.`** stub for “Adventure is running” when it is not.

## Acceptance criteria (EARS)

- **WHEN** the **`./adventure`** binary is present and wired **THEN** I **SHALL** see **real room/parser output** in the transcript after I submit a valid command (e.g. `look`).
- **WHEN** the binary is **missing** or the engine cannot start **THEN** I **SHALL** see a **clear message in the UI** (not only server logs) explaining that the game is unavailable — **not** a silent fallback that looks like successful play.
- **IF** a non-production “stub oracle” exists for automated tests **THEN** it **SHALL NOT** be the **default** path for this shell without an explicit, visible mode label (ties to [US-2-1](US-2-1-connection-status-visible.md)).

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
