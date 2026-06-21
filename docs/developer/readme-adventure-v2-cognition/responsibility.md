# Responsibility

- **LangGraph** turn brain ([`runTurnBrainGraph.ts`](../../adventure-v2/packages/cognition/src/brain/runTurnBrainGraph.ts)): `perceive` → `plan` → `act`
- Stub prompts in [`src/prompts/`](../../adventure-v2/packages/cognition/src/prompts/) with **`promptDigest`** on **`plan`** traces
- Reconcile classification ([`classifyReconcile.ts`](../../adventure-v2/packages/cognition/src/reconcile/classifyReconcile.ts))

`plan` still uses stub prompts until a real **ModelAdapter** is wired.
