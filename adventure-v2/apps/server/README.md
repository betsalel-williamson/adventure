# server — package README

## Responsibility

- Session/run lifecycle HTTP API
- Bridge commands and observations to/from the adventure oracle
- LangGraph pre-oracle cognition + XState loop policy via `RunCoordinator`
- Ordered SSE fanout of turn, phase, and cognition trace events

Oracle selection: persistent Fortran when `./adventure` exists, synthetic default, or explicit process bridge script — see the **Oracle modes** section in the [adventure-v2 README](../../../README.md).

## Layout

| Path | Contents |
| --- | --- |
| `src/http/` | Routes, SSE handlers, CORS, body size limits |
| `src/run/` | `RunCoordinator`, sequence assignment |
| `src/oracle/` | Synthetic default, persistent Fortran, process bridge |
| `src/replay/` | Checkpoint registry and replay entrypoints |

Architecture: [`docs/architecture/adventure-v2/oracle-subprocess-ipc.md`](../../../docs/architecture/adventure-v2/oracle-subprocess-ipc.md).
