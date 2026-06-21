# NL autoplay dashboard (source)

The **adventure-nl autoplay dashboard** is the v1 research surface: three-column layout with planner state, CRT hero, and map/cognition tabs.

## Entry points

| Path | Role |
| ---- | ---- |
| `adventure-nl/public/index.html` | Dashboard layout |
| `adventure-nl/public/app.js` | Bootstrap, SSE, manual input, autoplay |
| `adventure-nl/src/cli/webDashboard.ts` | HTTP server — static files + REST + SSE `/events` |
| `adventure-nl/README.md` | Operator reference |

**Run:** `cd adventure-nl && npm run build && npm run web` → `https://127.0.0.1:8787`

## Panel inventory (migration targets)

### Left column — planner state

| UI | Module | Webclient flag |
| -- | ------ | -------------- |
| Prompt projects | `promptLab.js` | (future `promptProjects`) |
| Leaderboard | `app.js` | `leaderboard` |
| LLM generation params | `promptLab.js` | `promptLab` |
| Last plan → GETIN | SSE `plan_applied` | `autoplayControls` |
| Heuristic state / verb hints | SSE | `autoplayControls` |

### Center — CRT + controls

| UI | Module | Webclient flag |
| -- | ------ | -------------- |
| Game transcript | `transcriptView.js` | `crtTranscript` |
| Manual command input | `app.js` | `crtTranscript` |
| CRT control deck (model, pace, steps) | `app.js` | `autoplayControls` |
| Prompt lab inline | `promptLab.js` | `promptLab` |
| Autoplay diagnostics log | `transcriptView.js` | `autoplayControls` |

### Right column — maps and cognition

| UI | Module | Webclient flag |
| -- | ------ | -------------- |
| Session FSM Mermaid tab | `mapView.js` | `sessionFsmMermaid` |
| 3D exploration grid | `mapView.js` | `explorationMapGrid` |
| Cognition orchestration card | `cognitionOrchestrationPanel.js` | `cognitionOrchestration` |
| Stately Inspect iframe | `/stately-inspect` | `statelyInspect` |

## API patterns to preserve

**REST:** `/api/session`, `/api/engine/input`, `/api/autoplay-mode`, `/api/text-llm`, `/api/prompt-projects/*`, …

**SSE `/events`:** `transcript_delta`, `plan_applied`, `planner_phase`, `turn_end`, `text_llm`, …

**Browser autoplay:** Default path uses in-browser NL glue + vendor APIs (ADR0015) — not `POST /api/nl/planner`.

When `VITE_WEBCLIENT_GAME_BACKEND=nl-dashboard`, the webclient should target the NL dashboard origin (`VITE_NL_DASHBOARD_URL`).

## Finished vs deferred (from source package)

**Mature:** full dashboard, browser/server autoplay, prompt lab, FSM + grid maps, Stately bridge, benchmark leaderboard.

**Deferred:** Monaco workspace tab, browser interpret replacing server NL routes, durable glue checkpoints across refresh.

## Migration strategy

Do **not** port the entire dashboard in one step. Use [feature catalog](feature-catalog.md) order:

1. Document each panel (this file + future shards)
2. Enable webclient flag + placeholder
3. Port module with Vitest/DOM harness
4. Point at NL or v2 backend via adapter env

## Related docs

- `adventure-nl/docs/source-map.md` — module map
- [Research workflows](../../client/research-workflows.md)
- [Feature catalog](feature-catalog.md)
