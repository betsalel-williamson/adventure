# Adventure v2 slice 16: CRT shell, flow diagrams, prompt visibility

**Cursor plan (YAML + todos):** [`.cursor/plans/v2_crt_shell_observability_521178f7.plan.md`](../../.cursor/plans/v2_crt_shell_observability_521178f7.plan.md)

---

## Visualization strategy

| Approach | Theme fit | Offline | Sync risk |
|----------|-----------|---------|-----------|
| **Mermaid in `apps/web`** | Strong — same page as CRT terminal | Yes | LangGraph: codegen; XState: Vitest |
| **XState Inspector** | Weak — separate window | Yes | Automatic |
| **LangSmith / LangGraph Studio** | Weak — external | Often keys/network | Automatic |

Use **Mermaid** in-shell; no Inspector/LangSmith this slice. **Trace accumulation (step 2)** is still required for prompt visibility — graph tools do not replace a historical prompt log.

---

## Where things stand

- **Planning queue:** [`.work-items/planning/plan-queues-index.md`](../planning/plan-queues-index.md) — `BetweenPlans`; slice 15 complete.
- **v2 web shell:** [`adventure-v2/apps/web/index.html`](../../adventure-v2/apps/web/index.html), [`main.ts`](../../adventure-v2/apps/web/src/main.ts).
- **v1 CRT reference:** [`adventure-nl/public/dashboard.css`](../../adventure-nl/public/dashboard.css).
- **LangGraph brain:** [`packages/cognition/src/brain/runTurnBrainGraph.ts`](../../adventure-v2/packages/cognition/src/brain/runTurnBrainGraph.ts); plan emits **`promptSystem` / `promptUser`** on traces ([`wire.ts`](../../adventure-v2/packages/contracts/src/http/wire.ts)).
- **XState:** [`packages/control/src/machine/controlMachine.ts`](../../adventure-v2/packages/control/src/machine/controlMachine.ts) — **`ControlPhase`**: `act | think | test | chaos | disorder`; **`invalidRouting`** is a transient state id (not a `ControlPhase`).

### Gap

[`main.ts`](../../adventure-v2/apps/web/src/main.ts) overwrites `#cognition-trace` on each SSE `trace`; final **`reconcile`** trace hides **`plan`** prompts unless the UI accumulates.

### Stub autoplay

[`AUTOPLAY_MAX_MOVES`](../../adventure-v2/apps/web/src/main.ts) is **8** → bump to **10**.

---

## Implementation order

### 1) CRT presentation

Minimal v1-like bezel/phosphor around `#game-terminal`; optional VT323; heavier SVG parity optional. No API changes.

### 2) Cognition trace — TDD first

Append helpers + [`tests/wireDisplay.test.ts`](../../adventure-v2/tests/wireDisplay.test.ts), then [`main.ts`](../../adventure-v2/apps/web/src/main.ts); optional cap + README note.

### 3) Agent diagrams panel

- **LangGraph:** native **`drawMermaid`** (or equivalent) via small **codegen script** into [`apps/web/src/agentDiagrams.ts`](../../adventure-v2/apps/web/src/agentDiagrams.ts); optional HTTP/SSE alternative.
- **XState:** hand-authored Mermaid + Vitest for **`ControlPhase`** strings; document **`invalidRouting`** if shown.
- **`mermaid`** package in Vite shell.

### 4) Ten moves

`AUTOPLAY_MAX_MOVES = 10`.

### 5) Fortran smoke

Manual: `make adventure`, `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs`, 10-move autoplay.

### 6) Multidisciplinary review

[`slice-16-multidisciplinary-review.md`](slice-16-multidisciplinary-review.md), [`task.md`](task.md), [plan-queues-index](../planning/plan-queues-index.md); fix only listed issues.

---

## Risk controls

No wire changes unless review demands. Prefer codegen diffs for LangGraph Mermaid when topology changes.

See diagrams in [`.cursor/plans/v2_crt_shell_observability_521178f7.plan.md`](../../.cursor/plans/v2_crt_shell_observability_521178f7.plan.md) (SSE → UI + codegen flow).
