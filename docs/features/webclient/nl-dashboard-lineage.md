# NL dashboard lineage

The **adventure-nl autoplay dashboard** is the v1 research surface — three-column layout with planner state, CRT hero, map/cognition tabs, and browser-orchestrated autoplay.

The webclient preserves this lineage behind research feature flags rather than replacing the dashboard in one step.

## Product surfaces (NL origin)

| Panel group | Webclient flags (when migrated) |
| ----------- | -------------------------------- |
| Prompt lab, generation params | `promptLab` |
| Autoplay deck, diagnostics | `autoplayControls` |
| 3D exploration grid | `explorationMapGrid` |
| Session FSM Mermaid | `sessionFsmMermaid` |
| Cognition orchestration, Stately | `cognitionOrchestration`, `statelyInspect` |
| Benchmark leaderboard | `leaderboard` |

## Run today

```bash
cd adventure-nl && npm run build && npm run web
```

Dashboard at `<https://127.0.0.1:8787>` — [adventure-nl README](../../adventure-nl/README.md).

## Migration approach

Port one panel at a time into webclient; enable via flags; wire NL dashboard backend when `VITE_WEBCLIENT_GAME_BACKEND=nl-dashboard`.

Inventory and source paths: [Developer — migration catalog](../../developer/webclient-migration-catalog.md)

User persona: [Client — evaluating agent behavior](../../client/webclient/evaluating-agent-behavior.md)
