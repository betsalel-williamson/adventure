# US-4-1 — Session signals visible

## Epic

[E4 — Session awareness and honest agent surfacing](../epics/E4-session-awareness-and-agent-surfacing.md)

## User story

**As a** visitor exploring Colossal Cave
**I want** a concise view of **what the assistant noticed** during my session (without it playing for me)
**so that** I can tell the assistant is **paying attention** to the same text I see—not pretending to run the game autonomously.

## Acceptance criteria (EARS)

- **WHEN** I read or enter commands in the shell **THEN** I **SHALL** see **an ancillary region** (not replacing the hero transcript) summarizing **session signals** in plain language—a **small fixed set** of cue types (for example places or exits mentioned, recent moves); exact fields are fixed in design or tasks and stay bounded for tests.
- **WHEN** the assistant has nothing reliable to report yet **THEN** I **SHALL** see **an explicit empty or waiting state**, not a blank that feels broken.
- **WHILE** session signals update **THEN** I **SHALL NOT** see game commands sent **from the assistant** unless a separate story explicitly enables that behavior.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
