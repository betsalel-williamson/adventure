# adventure-webclient — tasks

Incremental migration. Each task is independently testable. Follow TDD when porting behavior.

## Phase 0 — foundation ✅

- [x] Create `adventure-webclient/` stub with Vite + feature flags
- [x] Backend adapter types and env config
- [x] Feature catalog + first three feature shards in docs
- [x] Dev setup doc

## Phase 1 — CRT + game adapter

**Objective:** Play Colossal Cave through webclient against v2 HTTP.

**Requirements:** [crt-transcript-panel.md](../../docs/features/webclient/crt-transcript-panel.md)

**Acceptance criteria:**

- WHEN `crtTranscript` is on AND v2 server is up THEN user can submit commands and see oracle text
- WHEN v2 is down THEN status strip shows plain-language failure
- Vitest covers flag resolution and game adapter config

**Test strategy:** Port langgraph `api/client.ts`, `wire/parse.ts`, `wire/virtualTerminal.ts`; jsdom harness for transcript buffer.

## Phase 2 — Mermaid exploration map

**Objective:** Beside-column draft map with LangGraph assist ingest.

**Requirements:** [exploration-map-mermaid.md](../../docs/features/webclient/exploration-map-mermaid.md)

**Acceptance criteria:**

- WHEN `explorationMapMermaid` is on THEN diagram updates from transcript
- WHEN assist is unreachable THEN local map-core merge OR clear error
- `VITE_WEBCLIENT_ASSIST_BACKEND=langgraph` routes to assist server

## Phase 3 — Status strip + health

Port `status/health.ts` from langgraph; unify oracle hint copy.

## Phase 4 — Legacy assist panels

Port posture, session signals, map probe, inspectors behind individual flags.

Document each with a new shard before implementation:

- `assistance-posture-panel.md`
- `session-signals-panel.md`
- `map-probe-and-inspectors.md`

## Phase 5 — NL research panels

Port selected modules from `adventure-nl/public/`:

1. Prompt lab
2. Autoplay controls + browser orchestrator hook
3. Session FSM / 3D grid (compare doc)
4. Cognition + Stately (research-only defaults off)

**Test strategy:** Vitest for pure helpers; optional DOM harness mirroring langgraph `loadShellDom.ts` pattern.

## Phase 6 — AG2 assist backend wiring

When adventure-ag2 HTTP/subprocess adapter exists, connect `VITE_WEBCLIENT_ASSIST_BACKEND=ag2` to handoff graph.

## Traceability

| Task | Catalog flags |
| ---- | ------------- |
| Phase 1 | `crtTranscript`, `statusStrip` |
| Phase 2 | `explorationMapMermaid` |
| Phase 4 | `assistPanels`, `assistancePosture`, `sessionSignals`, `mapProbe`, `mapInspectors` |
| Phase 5 | `promptLab`, `autoplayControls`, `sessionFsmMermaid`, `explorationMapGrid`, `cognitionOrchestration`, `statelyInspect`, `leaderboard` |
