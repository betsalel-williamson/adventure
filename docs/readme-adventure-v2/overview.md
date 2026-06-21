# Overview

HTTP + SSE game API for benchmark-oriented adventure orchestration with LangGraph cognition stubs and XState loop control.

| Package | Role |
| --- | --- |
| `packages/contracts` | Turn/reconcile/checkpoint schemas + HTTP/SSE wire types |
| `apps/server` | `RunCoordinator`, oracle bridge, HTTP API, SSE fanout |
| `apps/web` | Vite dev shell — CRT game terminal, SSE panels, stub autoplay |
| `packages/cognition` | LangGraph turn brain (`perceive` → `plan` → `act`) |
| `packages/control` | XState loop policy and phase telemetry |

**Not yet:** deployment hardening (auth, rate limits, TLS termination), real ModelAdapter in `plan`, Playwright E2E.

Architecture: [`docs/architecture/adventure-v2/`](../architecture/adventure-v2/overview.md).
