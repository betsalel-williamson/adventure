# Multidisciplinary review — adventure-v3 slice 05 (Cartographer + Navigator, LangGraph + SLM draft map)

Audience: UX, architecture, operations. Scope: **`adventure-v3`** CRT shell plus **`packages/map-core`**, **`packages/assist-server`**: inspectable **draft** directed-graph map, **LangGraph** cartographer/navigator pipeline, **SLM adapter** (Ollama or deterministic heuristic).

## UX / product

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Users need to see **draft** map as non-authoritative | Draft map strip copy states Fortran/play is truth; clipboard adds **Draft assistance — not authoritative…** disclaimer ([`draftMapCopy.ts`](../../adventure-v3/apps/web/src/assist/draftMapCopy.ts), [`draftMapUi.ts`](../../adventure-v3/apps/web/src/assist/draftMapUi.ts)). |
| P0 | **US‑3‑1** honesty — avoid implying LLM when using heuristic only | README and on-page label describe **LangGraph + local heuristic or Ollama SLM**; heuristic-only documented on **`GET /assist/health`** ([`README.md`](../../adventure-v3/README.md)). |
| P0 | **Study first** must gate automated moves ([US‑4‑3 posture](stories/US-4-3-user-chooses-assistance-posture.md)) | **`POST /assist/step`** rejects advancing without `studyFirstConfirmed` when posture is **`studyFirst`**; UI checkbox **`assist-study-confirm`** ([`server.ts`](../../adventure-v3/packages/assist-server/src/server.ts), [`main.ts`](../../adventure-v3/apps/web/src/main.ts)). |
| P1 | Inspect graph without probing | **`advance: false`** path merges transcript only; **Refresh draft map** button ([`server.ts`](../../adventure-v3/packages/assist-server/src/server.ts)). |
| P1 | Dismiss hides panels without destroying session | **Hide diagram panels** clears pre elements; probe state untouched ([`draftMapUi.ts`](../../adventure-v3/apps/web/src/assist/draftMapUi.ts)). |
| P2 | Probe cannot run unbounded | **400-step** ceiling stops probe ([`main.ts`](../../adventure-v3/apps/web/src/main.ts)). |

## Architecture

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Fortran / v2 HTTP remain game authority ([`design-agentic-mvp.md`](design-agentic-mvp.md)) | Assist server **never** owns game state; browser posts turns to **adventure‑v2** only. |
| P1 | **Directed graph** from observed moves only | **`mergeGraphFromTranscript`** in [`kernel.ts`](../../adventure-v3/packages/map-core/src/kernel.ts); Maudlin 2014 framing as **reading** comment in [`directedGraph.ts`](../../adventure-v3/packages/map-core/src/directedGraph.ts). |
| P1 | **LangGraph** wires cartographer then navigator ([`assistGraph.ts`](../../adventure-v3/packages/assist-server/src/assistGraph.ts)) | Stateless compile; per-**runId** graph held in [`server.ts`](../../adventure-v3/packages/assist-server/src/server.ts). |
| P1 | SLM failures should not brick probe | Navigator node **falls back** to deterministic `chooseNextExplorationMove` on adapter throw ([`assistGraph.ts`](../../adventure-v3/packages/assist-server/src/assistGraph.ts)). |
| P2 | Browser owns DOM — assist returns JSON only | Responses carry **nextMove**, **mapJson**, **mermaid**; CRT updates stay in **`main.ts`**. |

## Operations

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Local dev ergonomics | **`npm start`** starts API + CRT + assist; **`npm run assist:dev`** alone optional; **`VITE_ASSIST_URL`**, **`ASSIST_SERVER_PORT`**, **`OLLAMA_URL`** / **`OLLAMA_MODEL`** ([`README.md`](../../adventure-v3/README.md)). |
| P1 | CORS | Assist server sends **`Access-Control-Allow-Origin: *`** for local dev ([`server.ts`](../../adventure-v3/packages/assist-server/src/server.ts)) — tighten before any non-localhost exposure. |
| P2 | CI does not run Ollama | Default adapter is **heuristic**; **`createOllamaSlmAdapter`** optional when env set ([`server.ts`](../../adventure-v3/packages/assist-server/src/server.ts)). |

## Verification performed

Commands run successfully:

- `cd adventure-v3 && npm run verify`

## Navigation

[`.work-items/adventure-v3/index.md`](index.md)
