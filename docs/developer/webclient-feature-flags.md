# Webclient feature flags

Operator reference for `adventure-webclient/apps/web/webclient-feature-flags.json`.

**Override order:** query string → `sessionStorage` (`adventure-webclient-flag-<name>`) → Vite env → JSON defaults.

## Core shell

| Flag | Env | Default | Panel |
| ---- | --- | ------- | ----- |
| `crtTranscript` | `VITE_WEBCLIENT_CRT_TRANSCRIPT` | on | CRT hero + command line |
| `statusStrip` | `VITE_WEBCLIENT_STATUS_STRIP` | on | API / oracle health |

## Exploration maps

| Flag | Env | Default | Panel |
| ---- | --- | ------- | ----- |
| `explorationMapMermaid` | `VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID` | off | Mermaid beside-CRT map |
| `explorationMapGrid` | `VITE_WEBCLIENT_EXPLORATION_MAP_GRID` | off | NL 3D grid map |

## Assist (langgraph lineage)

| Flag | Env | Default | Panel |
| ---- | --- | ------- | ----- |
| `assistPanels` | `VITE_WEBCLIENT_ASSIST_PANELS` | off | Legacy assist stack |
| `assistancePosture` | `VITE_WEBCLIENT_ASSISTANCE_POSTURE` | off | Quick assist / Study first |
| `sessionSignals` | `VITE_WEBCLIENT_SESSION_SIGNALS` | off | Transcript-derived cues |
| `mapProbe` | `VITE_WEBCLIENT_MAP_PROBE` | off | Assist-backed probe |
| `mapInspectors` | `VITE_WEBCLIENT_MAP_INSPECTORS` | off | Mermaid source + JSON |

## Research (NL lineage)

| Flag | Env | Default | Panel |
| ---- | --- | ------- | ----- |
| `promptLab` | `VITE_WEBCLIENT_PROMPT_LAB` | off | Prompt patch + generation |
| `autoplayControls` | `VITE_WEBCLIENT_AUTOPLAY_CONTROLS` | off | Model, pace, diagnostics |
| `sessionFsmMermaid` | `VITE_WEBCLIENT_SESSION_FSM_MERMAID` | off | Session FSM tab |
| `cognitionOrchestration` | `VITE_WEBCLIENT_COGNITION_ORCHESTRATION` | off | XState snapshot card |
| `statelyInspect` | `VITE_WEBCLIENT_STATELY_INSPECT` | off | Stately iframe |
| `leaderboard` | `VITE_WEBCLIENT_LEADERBOARD` | off | Benchmark runs |

## Developer

| Flag | Env | Default | Panel |
| ---- | --- | ------- | ----- |
| `featureFlagDevPanel` | `VITE_WEBCLIENT_FEATURE_FLAG_DEV_PANEL` | on | Runtime enabled-flag list |

## Examples

```bash
# Player + Mermaid map
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true npm run dev

# Query override
http://127.0.0.1:5175/?promptLab=true&autoplayControls=true
```

Persona groupings: [Client — choose your surface](../client/webclient/choose-your-surface.md)

Migration status: [Migration catalog](webclient-migration-catalog.md)
