# Work in progress (short pointer)

**Update when focus shifts.** Last touched: **2026-05-09**

## Where we are right now

[**Current development loop snapshot**](plan-queues-index.md#current-development-loop-snapshot) in [`plan-queues-index.md`](plan-queues-index.md) — **source of truth** for loop state, plan/slice, blocking, and “next after this.”

**As of last edit:** Adventure v2 **`AwaitingHILCommit`** (**slice 1**, M1–M8 baseline green in `adventure-v2/`); AAB **`Implementing`** per active queue.

## Primary focus

Agentic Adventure Benchmarker (AAB) — LangGraph.js brain + deterministic world (XState), per pivoted PRD.

## Canonical Cursor plan file

[`.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md`](../../.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md)

## Adventure v2 (secondary track)

Roadmap and queues: [`plan-queues-index.md`](plan-queues-index.md). Implementation plan: [`.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md`](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md). First vertical slice lives under `adventure-v2/` (run `npm test` there). When green and uncommitted, list the slice under **Awaiting commit / HIL gate** there.

## Queue roster

Maintain lifecycle queues and loop snapshot in [`plan-queues-index.md`](plan-queues-index.md).

This file intentionally stays short; detailed status and inventories live there.
