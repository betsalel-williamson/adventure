# Work in progress (short pointer)

**Update when focus shifts.** Last touched: **2026-05-09** (Slice 11 planning snapshot)

## Where we are right now

[**Current development loop snapshot**](plan-queues-index.md#current-development-loop-snapshot) in [`plan-queues-index.md`](plan-queues-index.md) — **source of truth** for loop state, plan/slice, blocking, and “next after this.”

**As of last edit:** Adventure v2 **`BetweenPlans`** — **Slice 11** (operational readiness: `/health`, JSON body cap) **shipped**; slices 1–11 **complete** in-tree per [`plan-queues-index.md`](plan-queues-index.md). AAB **`Implementing`** per active queue.

## Primary focus

Agentic Adventure Benchmarker (AAB) — LangGraph.js brain + deterministic world (XState), per pivoted PRD.

## Canonical Cursor plan file

[`.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md`](../../.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md)

## Adventure v2 (secondary track)

Roadmap and queues: [`plan-queues-index.md`](plan-queues-index.md). Status and finished slices: **§ Current development loop snapshot** and **Finished queue** in that file. Historical plans (examples): [slice 1 — minimal milestones](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md), [slice 2 — HTTP/SSE](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md). Code: [`adventure-v2/`](../../adventure-v2/) (`npm test`). When a slice is green and uncommitted, list it under **Awaiting commit / HIL gate** in the index.

## Queue roster

Maintain lifecycle queues and loop snapshot in [`plan-queues-index.md`](plan-queues-index.md).

This file intentionally stays short; detailed status and inventories live there.
