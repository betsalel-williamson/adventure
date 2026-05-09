# adventure-v2 server app (planned)

## Responsibility

- Own session/run lifecycle APIs.
- Bridge commands and observations to/from external adventure oracle.
- Emit ordered turn events for web clients and benchmark storage.

## Initial scaffold targets

- `src/http/` routes and SSE handlers.
- `src/run/` run coordinator and sequence assignment.
- `src/oracle/` synthetic default, `createProcessOracleBridge` (subprocess JSON line protocol — see `docs/architecture/adventure-v2/oracle-subprocess-ipc.md`).
- `src/replay/` checkpoint registry and replay entrypoints.
