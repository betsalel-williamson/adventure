# AP-2-1 — Configure, run, see, learn

## Epic

[AP2 — Run and learn loop](../epics/AP2-run-and-learn-loop.md)

## User persona

See [persona.md](../persona.md) — **Agent builder Avery**.

## User story

**As an** agent builder Avery
**I want** to **change** my project configuration, **run** automated play against the adventure, and **see results** I can use to improve exploration, puzzle-solving, and learning strategies
**so that** each iteration teaches me **what to try next**

## Acceptance criteria (EARS)

- **WHEN** I change **project configuration** and start a run **THEN** I **SHALL** see that run **reflect** my latest definitions without unexplained stale behavior.
- **WHEN** a run finishes or stops **THEN** I **SHALL** see **enough of what happened** (transcript or summary suited to the surface) to judge **exploration progress**, **puzzle attempts**, and **what failed or succeeded**.
- **IF** a run cannot start or the adventure is **unavailable** **THEN** I **SHALL** see a **clear, actionable message** (what is wrong and what to check)—not only a blank screen or a raw technical code with no explanation.
- **WHILE** I am iterating **THE USER SHALL** be able to complete **configure → run → review → adjust** in a **straightforward** sequence without unnecessary extra steps.

## Success metrics (verifiable)

- Demonstrable **happy path** and **failure path** through the loop with criteria above satisfied in review or user-facing tests.

## Notes

- Depth of “explain why the agent chose X” may grow in later stories; this story requires **results sufficient to learn**, not full cognitive traces.

## Navigation

[stories/index.md](index.md) · [index.md](../index.md)
