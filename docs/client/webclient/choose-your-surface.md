# Choose your surface

Match the webclient panels to what you are trying to do. Panels are **off by default** except the CRT shell and developer flag summary — enable them when you need them (see [Developer — feature flags](../../developer/webclient-feature-flags.md)).

## Player

**Goal:** Play Colossal Cave with minimal chrome.

| You need | Enable |
| -------- | ------ |
| Game transcript + command line | `crtTranscript` (default on) |
| Plain-language API/oracle status | `statusStrip` (default on) |

Keep exploration map and research panels off if they distract from reading room text.

## Map explorer

**Goal:** View draft topology while you move.

| You need | Enable |
| -------- | ------ |
| Player surface (above) | `crtTranscript`, `statusStrip` |
| Mermaid directed graph beside CRT | `explorationMapMermaid` |
| 3D grid view (NL lineage, when migrated) | `explorationMapGrid` |

Treat the map as **draft assistance** — the [Fortran oracle](../../glossary/oracle.md) remains truth for room state.

## Agent researcher

**Goal:** Compare models and agent backends on the same UI.

| You need | Enable |
| -------- | ------ |
| Player + map surfaces | As above |
| Prompt and generation controls | `promptLab` |
| Autoplay pace, model, diagnostics | `autoplayControls` |
| Session FSM or cognition traces | `sessionFsmMermaid`, `cognitionOrchestration`, `statelyInspect` |
| Benchmark leaderboard | `leaderboard` |

When you publish results, label whether output came from **oracle text**, **draft map/hints**, or **scripted probe** — see [Evaluating agent behavior](evaluating-agent-behavior.md).

## Maintainer / operator

**Goal:** Toggle panels and point at backends during development.

| You need | Enable |
| -------- | ------ |
| Runtime list of active flags | `featureFlagDevPanel` (default on in stub) |

Backend targets (`v2-http`, `langgraph`, `ag2`, `nl-dashboard`, …) are env-driven — [Developer — webclient dev setup](../../developer/webclient-dev-setup.md).
