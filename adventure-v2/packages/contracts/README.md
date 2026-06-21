# contracts — package README

## Responsibility

Shared runtime schemas and type-safe contracts for:

- Turn events and reconcile outcomes
- Checkpoints and replay payloads
- Run/session API shapes
- HTTP/SSE wire envelopes (`CreateRunRequest`, `SseWireEvent`, …)

Contract tests guard wire shape before adapters and orchestration change.

## Layout

| Path | Contents |
| --- | --- |
| `src/events/` | Turn and observation event types |
| `src/reconcile/` | Reconcile outcome schemas |
| `src/checkpoints/` | Checkpoint and replay refs |
| `src/api/` | Run config and session types |
| `src/http/wire.ts` | REST + SSE payload shapes |
| `src/index.ts` | Public export map |

Tests: [`tests/contracts.test.ts`](../../tests/contracts.test.ts).
