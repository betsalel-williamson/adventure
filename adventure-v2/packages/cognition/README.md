# cognition — package README

## Responsibility

- **LangGraph** turn brain ([`runTurnBrainGraph.ts`](src/brain/runTurnBrainGraph.ts)): `perceive` → `plan` → `act`
- Stub prompts in [`src/prompts/`](src/prompts) with **`promptDigest`** on **`plan`** traces
- Reconcile classification ([`classifyReconcile.ts`](src/reconcile/classifyReconcile.ts))

`plan` still uses stub prompts until a real **ModelAdapter** is wired.

## Layout

| Path | Role |
| --- | --- |
| `src/brain/` | LangGraph graph + reconcile trace helper |
| `src/reconcile/` | Drift classification |
| `src/prompts/` | Stub agent prompts for deterministic CI |

Regenerate LangGraph Mermaid for the web shell: `npm run codegen:brain-mermaid` from adventure-v2 root.
