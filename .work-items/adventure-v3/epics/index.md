# Epics — catalog

Each epic groups **user stories** (one file per story under [`../stories/`](../stories/)). Implementation order follows **user value**, not epic number.

| Epic | Title | Stories | Intent |
| --- | --- | --- | --- |
| **E1** | [E1-crt-and-play.md](E1-crt-and-play.md) | [US-1-1](../stories/US-1-1-crt-hero-layout.md), [US-1-2](../stories/US-1-2-real-game-or-clear-failure.md) | One page dominated by a **v1-style CRT transcript** and input; **real Fortran output** or **explicit failure** — no silent fake cave. |
| **E2** | [E2-trust-and-clarity.md](E2-trust-and-clarity.md) | [US-2-1](../stories/US-2-1-connection-status-visible.md) | One visible **trust signal** so users know whether they are on **real Adventure**. |
| **E3** | [E3-automation.md](E3-automation.md) | [US-3-1](../stories/US-3-1-honest-scripted-autoplay.md) | **Optional** multi-turn control with **honest** labeling (not implied LLM). |

## Traceability

| Story ID | Epic |
| --- | --- |
| US-1-1, US-1-2 | E1 |
| US-2-1 | E2 |
| US-3-1 | E3 |

## Navigation

[index.md](../index.md) · [stories/index.md](../stories/index.md)
