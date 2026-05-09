# Adventure v2 — Slice 13 (LangGraph + XState + cognition trace MVP)

**Status:** implemented (2026-05-09).

## Summary

- **`@langchain/langgraph`** (`runTurnBrainGraph`): `perceive` → `plan` → `act`; **`plan`** emits **`promptDigest`** / **`promptSummary`** (stub prompts, deterministic CI).
- **`xstate`**: real **`createMachine`** + **`createActor`** in [`packages/control/src/machine/controlMachine.ts`](../../adventure-v2/packages/control/src/machine/controlMachine.ts) (replaces hand-rolled object).
- **Wire / tests**: extended **`CognitionTraceWire`**; **10** SSE events per turn; async **`RunCoordinator.processTurn`**.

## Close-out

- Multidisciplinary review: [`slice-13-multidisciplinary-review.md`](slice-13-multidisciplinary-review.md)
- User-facing product detail: [`adventure-v2/README.md`](../../adventure-v2/README.md) (Slice 13 bullet)

## Deferred

- LangGraph **checkpointer** aligned with **`CheckpointRef`** / replay API.
- Real **LLM** / **ModelAdapter** in **`plan`** (AAB roadmap).
