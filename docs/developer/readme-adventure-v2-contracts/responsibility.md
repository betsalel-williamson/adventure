# Responsibility

Shared runtime schemas and type-safe contracts for:

- Turn events and reconcile outcomes
- Checkpoints and replay payloads
- Run/session API shapes
- HTTP/SSE wire envelopes (`CreateRunRequest`, `SseWireEvent`, …)

Contract tests guard wire shape before adapters and orchestration change.
