# Work in progress (short pointer)

**Update when focus shifts.** Last touched: **2026-05-08**

## Where we are right now

[**Current development loop snapshot**](plan-queues-index.md#current-development-loop-snapshot) in [`plan-queues-index.md`](plan-queues-index.md) — **source of truth** for loop state, plan/slice, blocking, and “next after this.”

**As of last edit:** Adventure v2 **`Implementing`** (**slice 2**, HTTP/SSE plan); slice 1 (minimal milestones M1–M8) **complete**. AAB **`Implementing`** per active queue.

## Primary focus

Agentic Adventure Benchmarker (AAB) — LangGraph.js brain + deterministic world (XState), per pivoted PRD.

## Canonical Cursor plan file

[`.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md`](../../.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md)

## Adventure v2 (secondary track)

Roadmap and queues: [`plan-queues-index.md`](plan-queues-index.md). **Slice 2** implementation plan: [`.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md`](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md). **Slice 1** (complete): [`.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md`](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md). Code lives under `adventure-v2/` (run `npm test` there). When a slice is green and uncommitted, list it under **Awaiting commit / HIL gate** in the index.

## Queue roster

Maintain lifecycle queues and loop snapshot in [`plan-queues-index.md`](plan-queues-index.md).

This file intentionally stays short; detailed status and inventories live there.
