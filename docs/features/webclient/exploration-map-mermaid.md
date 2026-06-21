# Exploration map — Mermaid (langgraph)

The **Mermaid exploration map** is a beside-CRT panel showing a **draft** directed graph of inferred places and compass moves from the visible transcript.

## Source implementation

| Aspect | Detail |
| ------ | ------ |
| **Package** | adventure-langgraph |
| **Paths** | `apps/web/src/assist/explorationMapUpdate.ts`, `draftMapMermaidRender.ts`, `draftMapCopy.ts`, `shell/wireExplorationMapControls.ts` |
| **Map logic** | `@adventure-langgraph/map-core` — `mergeGraphFromTranscript`, `directedGraphToMermaidFlowchart` |
| **Assist API** | `POST /assist/ingest` when `locationAgent` flag on; local merge fallback when assist unreachable |
| **Feature flags (langgraph)** | `explorationMap`, `locationAgent` |
| **Feature flag (webclient)** | `explorationMapMermaid` (default **off** until migrated) |

Copy actions include an explicit **draft / Fortran is truth** disclaimer.

## Backend options (webclient)

| `VITE_WEBCLIENT_ASSIST_BACKEND` | Behavior |
| ------------------------------- | -------- |
| `langgraph` | `POST {VITE_ASSIST_URL}/assist/ingest` |
| `ag2` | Future AG2 handoff service (see [`adventure-ag2`](../../adventure-ag2/README.md)) |
| `local-map-core` | Browser-only merge via map-core (no HTTP) |
| `mock` | Frozen fixture graph for UI snapshots |

## Contrast with NL 3D grid

adventure-nl renders an **xyz grid** (`mapView.js`) from glue state — same assistance semantics, different visualization. Enable `explorationMapGrid` in webclient to compare both behind flags.

## Migration notes

1. Port `explorationMapUpdate.ts` into webclient (or shared package later)
2. Wire assist adapter interface — do not hard-code port 8790 in components
3. Keep Mermaid render lazy-loaded (`optimizeDeps: mermaid`) as in langgraph Vite config

## Acceptance (when migrated)

- WHEN transcript lines arrive THEN I SHALL see the beside-column diagram update without hiding game text
- WHEN assist is down THEN I SHALL still see a locally merged draft map OR a clear status message
- WHEN I copy the diagram THEN the clipboard SHALL include the draft disclaimer

## Related docs

- [Exploration map column](../exploration-map-column.md)
- [Assist runtime](../assist-runtime.md)
- [Feature catalog](feature-catalog.md)
