# adventure-v2 web app (planned)

## Responsibility

- Render console-first transcript and controls.
- Display XState control phase and LangGraph actor/node timeline.
- Consume server SSE/event stream and replay endpoints.

## Initial scaffold targets

- `src/app/` shell layout (console + observability panes).
- `src/state/` view-model adapters for stream events.
- `src/api/` typed API client wrappers from `packages/contracts`.
