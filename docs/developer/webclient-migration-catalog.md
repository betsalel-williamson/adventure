# Webclient migration catalog

Maintainer inventory of frontend panels migrating into `adventure-webclient/`. **Migration status** tracks port progress from source packages.

**Legend:** `documented` → spec written · `stub` → placeholder DOM · `migrated` → behavior ported · `source` → lives in origin package only

End-user personas: [Client guide — webclient](../client/webclient/index.md). Product capabilities: [Features — webclient](../features/webclient/index.md).

## Core shell

| Flag | Panel | Source package | Source path | Status |
| ---- | ----- | -------------- | ----------- | ------ |
| `crtTranscript` | CRT hero + command line | adventure-langgraph | `apps/web/src/main.ts`, `wire/virtualTerminal.ts` | stub |
| `crtTranscript` | CRT hero (autoplay layout) | adventure-nl | `public/transcriptView.js` | documented |
| `statusStrip` | API / oracle health | adventure-langgraph | `src/status/health.ts` | stub |

## Exploration maps

| Flag | Panel | Source package | Source path | Status |
| ---- | ----- | -------------- | ----------- | ------ |
| `explorationMapMermaid` | Mermaid DAG | adventure-langgraph | `src/assist/explorationMapUpdate.ts` | documented |
| `explorationMapGrid` | 3D xyz grid | adventure-nl | `public/mapView.js` | documented |

## Assist panels (langgraph lineage)

| Flag | Panel | Source path | Status |
| ---- | ----- | ----------- | ------ |
| `assistPanels` | Legacy assist stack | `index.html` `#v3-legacy-assist-panels` | documented |
| `assistancePosture` | Quick assist / Study first | `src/posture/assistancePosture.ts` | documented |
| `sessionSignals` | Transcript-derived cues | `src/session/sessionSignals.ts` | documented |
| `mapProbe` | Assist-backed probe | `src/assist/draftMapUi.ts` | documented |
| `mapInspectors` | Mermaid + JSON inspectors | `draftMapCopy.ts` | documented |

## Research panels (NL lineage)

| Flag | Panel | Source path | Status |
| ---- | ----- | ----------- | ------ |
| `promptLab` | Prompt patch + params | `public/promptLab.js` | documented |
| `autoplayControls` | Model, pace, steps | `public/app.js` | documented |
| `sessionFsmMermaid` | Session graph tab | `public/mapView.js` | documented |
| `cognitionOrchestration` | XState snapshot | `public/cognitionOrchestrationPanel.js` | documented |
| `statelyInspect` | Stately iframe | `src/cli/statelyInspectBridge.ts` | documented |
| `leaderboard` | Benchmark runs | `public/app.js` | documented |

## Developer tooling

| Flag | Panel | Status |
| ---- | ----- | ------ |
| `featureFlagDevPanel` | Enabled flags list | migrated |

## Recommended migration order

1. CRT transcript + v2 game adapter
2. Exploration map Mermaid + assist ingest
3. Status strip + health copy
4. Legacy assist panels
5. NL research panels (flag-gated, off by default)
6. Cognition / Stately depth

Tasks: [`.work-items/adventure-webclient/task.md`](../../.work-items/adventure-webclient/task.md)

## Documentation queue

Shard per feature before or alongside code port:

- [x] Glossary — [webclient](../glossary/webclient.md)
- [x] Client personas — [client/webclient/](../client/webclient/index.md)
- [x] Features — CRT, Mermaid map, grid, backends, NL lineage
- [ ] Assistance posture (client + features + developer)
- [ ] Session signals
- [ ] Map probe + inspectors
- [ ] Prompt lab
- [ ] Autoplay controls
- [ ] Cognition + Stately
