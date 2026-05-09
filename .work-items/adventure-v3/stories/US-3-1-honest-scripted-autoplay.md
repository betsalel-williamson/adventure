# US-3-1 — Honest scripted multi-turn control

## Epic

[E3 — Optional automation](../epics/E3-automation.md)

## User story

**As a** demo operator
**I want** a control that submits **multiple turns** and **appends output** to the transcript
**so that** others can watch sustained play **without** believing an LLM is reasoning when the backend is only a fixed script

## Acceptance criteria (EARS)

- **WHEN** I start multi-turn automation **THEN** the control **SHALL** be labeled so it **cannot** be read as “AI” or “agent” if the implementation is **deterministic / scripted** (exact label left to copy, but **must** be honest).
- **WHEN** automation runs **THEN** I **SHALL** see turns accumulate in the **same CRT transcript** as manual play.
- **IF** a future **model-driven** autoplay exists **THEN** it **SHALL** use **distinct** labeling from scripted automation (may be a follow-on story).

## Dependencies

[US-1-1](US-1-1-crt-hero-layout.md), [US-1-2](US-1-2-real-game-or-clear-failure.md), and [US-2-1](US-2-1-connection-status-visible.md) should be satisfied first.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
