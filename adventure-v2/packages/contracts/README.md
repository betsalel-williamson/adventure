# adventure-v2 contracts package (planned)

## Responsibility

Define shared runtime schemas and type-safe contracts for:

- turn events,
- reconcile outcomes,
- checkpoints/replay,
- run/session APIs,
- HTTP/SSE wire envelopes (`src/http/wire.ts`: `CreateRunRequest`, `SseWireEvent`, …).

## Initial scaffold targets

- `src/events/`
- `src/reconcile/`
- `src/checkpoints/`
- `src/api/`
- `src/http/` (REST + SSE payload shapes)
- `src/index.ts` export map

Contract tests are written before adapters and orchestration wiring.
