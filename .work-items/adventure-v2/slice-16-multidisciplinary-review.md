# Slice 16 multidisciplinary review (Adventure v2 — CRT shell, diagrams, cognition log)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **No wire changes:** [`SseWireEvent`](../../adventure-v2/packages/contracts/src/http/wire.ts) unchanged. Cognition UX is **client-side accumulation** of existing SSE **`trace`** payloads (`appendCognitionTraceEntry` in [`wireDisplay.ts`](../../adventure-v2/apps/web/src/wireDisplay.ts)).

### Testing / TDD

- [`tests/wireDisplay.test.ts`](../../adventure-v2/tests/wireDisplay.test.ts): `appendCognitionTraceEntry` (plan + reconcile retained; truncation).
- [`tests/agentDiagrams.test.ts`](../../adventure-v2/tests/agentDiagrams.test.ts): non-empty **`BRAIN_GRAPH_MERMAID`** from codegen; **`CONTROL_PHASE_LABELS`** / **`invalidRouting`** appear in XState Mermaid source.
- **`npm test`**, **`npm run test:cucumber`** green. Regenerate LangGraph Mermaid after topology edits: **`npm run codegen:brain-mermaid`**.

### Security / safety

- Full **`promptSystem`** / **`promptUser`** already flowed over SSE; accumulation shows more history in the browser — dev-shell risk unchanged (local tooling).

### UX / documentation

- [`index.html`](../../adventure-v2/apps/web/index.html): CRT wrapper + **agent structure** Mermaid targets.
- [`README.md`](../../adventure-v2/README.md): slice 16 bullet; test pyramid mentions **`agentDiagrams`** tests.
- [`design.md`](design.md) §3.3: slice 16 web-app note.

### Operability

- **`export compiledBrainGraph`** in [`runTurnBrainGraph.ts`](../../adventure-v2/packages/cognition/src/brain/runTurnBrainGraph.ts) supports codegen only (same package boundary).

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| **`plan` prompts hidden after reconcile trace** | Accumulated cognition trace buffer + separator blocks in **`wireDisplay`** / **`main.ts`**. |
| LangGraph diagram drift if hand-written | **`npm run codegen:brain-mermaid`** writes **`brainGraphMermaid.generated.ts`** via **`getGraph().drawMermaid()`**. |
| XState diagram drift | Manual Mermaid + **`agentDiagrams.test.ts`** phase / **`invalidRouting`** guards. |
| Stub autoplay fewer than 10 moves | **`AUTOPLAY_MAX_MOVES = 10`** in **`main.ts`**. |

## Sign-off

Slice 16 scope implemented; regressions:

`npm test && npm run test:cucumber` (add **`npm run test:oracle-fortran`** after oracle/subprocess edits; rerun **`npm run codegen:brain-mermaid`** after **`runTurnBrainGraph.ts`** graph edits).
