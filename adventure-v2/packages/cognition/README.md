# adventure-v2 cognition package

## Responsibility

- **LangGraph** turn brain ([`src/brain/runTurnBrainGraph.ts`](src/brain/runTurnBrainGraph.ts)): `perceive` → `plan` → `act`; stub prompts in [`src/prompts/`](src/prompts/) with **`promptDigest`** on **`plan`** traces.
- Consume **`OracleObservation`** via server orchestration; classify reconcile ([`src/reconcile/classifyReconcile.ts`](src/reconcile/classifyReconcile.ts)).
- Optional future: checkpoint-bound LangGraph state aligned with **`CheckpointRef`**.

## Layout

- `src/brain/` — LangGraph graph + reconcile trace helper.
- `src/reconcile/` — drift classification.
- `src/prompts/` — stub agent prompts for deterministic CI.
