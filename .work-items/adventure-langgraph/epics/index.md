# Epics — catalog

Each epic groups **user stories** (one file per story under [`../stories/`](../stories/)). Implementation order follows **user value**, not epic number.

| Epic | Title | Stories | Intent |
| --- | --- | --- | --- |
| **E1** | [E1-crt-and-play.md](E1-crt-and-play.md) | [US-1-1](../stories/US-1-1-crt-hero-layout.md), [US-1-2](../stories/US-1-2-real-game-or-clear-failure.md) | One page dominated by a **v1-style CRT transcript** and input; **real Fortran output** or **explicit failure** — no silent fake cave. |
| **E2** | [E2-trust-and-clarity.md](E2-trust-and-clarity.md) | [US-2-1](../stories/US-2-1-connection-status-visible.md) | One visible **trust signal** so users know whether they are on **real Adventure**. |
| **E3** | [E3-automation.md](E3-automation.md) | [US-3-1](../stories/US-3-1-honest-scripted-autoplay.md) | **Optional** multi-turn control with **honest** labeling (not implied LLM). |
| **E4** | [E4-session-awareness-and-agent-surfacing.md](E4-session-awareness-and-agent-surfacing.md) | [US-4-1](../stories/US-4-1-session-signals-visible.md), [US-4-2](../stories/US-4-2-operating-posture-visible.md), [US-4-3](../stories/US-4-3-user-chooses-assistance-posture.md) | **Ancillary** session signals and **plain-language** assistance posture—**sensing** first, user retains control. |
| **E5** | [E5-draft-world-picture-map-assist.md](E5-draft-world-picture-map-assist.md) | [US-5-1](../stories/US-5-1-draft-location-diagram-reviewable.md) | **Draft** location picture from play, clearly labeled—not implied ground truth. |

## Traceability

| Story ID | Epic |
| --- | --- |
| US-1-1, US-1-2 | E1 |
| US-2-1 | E2 |
| US-3-1 | E3 |
| US-4-1, US-4-2, US-4-3 | E4 |
| US-5-1 | E5 |

## Navigation

[index.md](../index.md) · [stories/index.md](../stories/index.md)
