# Webclient feature catalog

Master inventory of frontend panels and visuals. **Migration status** tracks movement into [`adventure-webclient`](../../adventure-webclient/README.md).

**Legend:** `documented` → spec written · `stub` → placeholder DOM in webclient · `migrated` → behavior ported · `source` → still lives in origin package only

## Core shell

| Feature flag | Panel | Source package | Source path | Migration |
| ------------ | ----- | -------------- | ----------- | --------- |
| `crtTranscript` | CRT hero transcript + command line | adventure-langgraph | `apps/web/index.html`, `src/main.ts`, `src/wire/virtualTerminal.ts` | stub |
| `crtTranscript` | CRT hero (autoplay layout) | adventure-nl | `public/index.html`, `public/transcriptView.js` | documented |
| `statusStrip` | API / oracle health strip | adventure-langgraph | `src/status/health.ts` | stub |

## Exploration maps

| Feature flag | Panel | Source package | Source path | Migration |
| ------------ | ----- | -------------- | ----------- | --------- |
| `explorationMapMermaid` | Beside-column Mermaid DAG | adventure-langgraph | `src/assist/explorationMapUpdate.ts`, `draftMapMermaidRender.ts` | documented |
| `explorationMapGrid` | 3D xyz room grid | adventure-nl | `public/mapView.js` | documented |

Both visualize **draft** inferred topology — different geometry (directed graph vs grid). See [exploration-map-mermaid.md](exploration-map-mermaid.md).

## Assist / agent surfacing (langgraph lineage)

| Feature flag | Panel | Source package | Source path | Migration |
| ------------ | ----- | -------------- | ----------- | --------- |
| `assistPanels` | Legacy assist `<details>` stack | adventure-langgraph | `index.html` `#v3-legacy-assist-panels` | documented |
| `assistancePosture` | Quick assist / Study first copy | adventure-langgraph | `src/posture/assistancePosture.ts` | documented |
| `sessionSignals` | Transcript-derived session cues | adventure-langgraph | `src/session/sessionSignals.ts` | documented |
| `mapProbe` | Assist-backed probe loop | adventure-langgraph | `src/assist/draftMapUi.ts` | documented |
| `mapInspectors` | Mermaid source + JSON `<details>` | adventure-langgraph | `index.html`, `draftMapCopy.ts` | documented |

Backend: LangGraph assist server (`8790`) or [`adventure-ag2`](../../adventure-ag2/README.md) when `VITE_WEBCLIENT_ASSIST_BACKEND=ag2`.

## Research dashboard (NL lineage)

| Feature flag | Panel | Source package | Source path | Migration |
| ------------ | ----- | -------------- | ----------- | --------- |
| `promptLab` | Prompt patch + generation params | adventure-nl | `public/promptLab.js` | documented |
| `autoplayControls` | Model, pace, max steps, interpret toggles | adventure-nl | `public/app.js`, `public/autoplayPace.js` | documented |
| `sessionFsmMermaid` | Session directed graph tab | adventure-nl | `public/mapView.js` | documented |
| `cognitionOrchestration` | XState actor snapshot card | adventure-nl | `public/cognitionOrchestrationPanel.js` | documented |
| `statelyInspect` | Stately Inspect iframe | adventure-nl | `src/cli/statelyInspectBridge.ts` | documented |
| `leaderboard` | SQLite benchmark runs | adventure-nl | `public/app.js`, `/api/benchmark-runs/leaderboard` | documented |

Backend: NL dashboard server (`npm run web`) or browser NL glue when `VITE_WEBCLIENT_AGENT_BACKEND=nl-glue-browser`.

## Developer tooling

| Feature flag | Panel | Source | Migration |
| ------------ | ----- | ------ | --------- |
| `featureFlagDevPanel` | Lists enabled flags at runtime | adventure-webclient | migrated |

## Flag override cheat sheet

```bash
# Enable Mermaid map panel for local UI work
?explorationMapMermaid=true

# Or sessionStorage (devtools console)
sessionStorage.setItem('adventure-webclient-flag-explorationMapMermaid', 'true'); location.reload()

# Or Vite env
VITE_WEBCLIENT_EXPLORATION_MAP_MERMAID=true npm run dev
```

## Migration order (recommended)

1. **CRT transcript + v2 game adapter** — unblocks all backend testing
2. **Exploration map Mermaid** — highest-value langgraph visual
3. **Status strip + assist ingest** — wires LangGraph/AG2 backends
4. **NL research panels** — behind `promptLab` / `autoplayControls` flags
5. **Cognition / Stately depth** — research-only, off by default

Track tasks in [`.work-items/adventure-webclient/task.md`](../../.work-items/adventure-webclient/task.md).

## Documentation queue

Pull features into dedicated shards **one at a time** (check off when shard exists):

- [x] CRT transcript panel — [crt-transcript-panel.md](crt-transcript-panel.md)
- [x] Exploration map Mermaid — [exploration-map-mermaid.md](exploration-map-mermaid.md)
- [x] NL dashboard overview — [nl-autoplay-dashboard.md](nl-autoplay-dashboard.md)
- [ ] Assistance posture panel
- [ ] Session signals panel
- [ ] Map probe + inspectors
- [ ] Prompt lab
- [ ] Autoplay controls + browser orchestrator
- [ ] Session FSM + 3D grid comparison doc
- [ ] Cognition orchestration + Stately Inspect
