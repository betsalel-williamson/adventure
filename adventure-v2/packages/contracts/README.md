# adventure-v2 contracts package (planned)

## Responsibility

Define shared runtime schemas and type-safe contracts for:

- turn events,
- reconcile outcomes,
- checkpoints/replay,
- run/session APIs.

## Initial scaffold targets

- `src/events/`
- `src/reconcile/`
- `src/checkpoints/`
- `src/api/`
- `src/index.ts` export map

Contract tests are written before adapters and orchestration wiring.
