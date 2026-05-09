# Adventure V2 Security and Operational Considerations

## Security considerations

- Keep model/provider secrets server-side; web receives only scoped runtime capabilities.
- Treat replay/checkpoint APIs as session-scoped resources with explicit authorization checks.
- Sanitize streamed event payloads to avoid exposing sensitive env/config values.
- Keep user-generated prompt/project content isolated from privileged runtime contexts.
- Define a no-user-account baseline for v2: no persistent end-user identity store is required for core benchmark operation.
- In no-user mode, treat each active session as its own principal and authorize all run/replay actions against that session principal only.
- Carry forward v1 transport defaults: serve dashboard APIs and SSE over HTTPS in normal development/operation; treat plain HTTP as explicit insecure fallback for trusted local-only cases.
- Carry forward v1 session hardening: issue opaque session cookies as `HttpOnly`; set `Secure` whenever HTTPS is enabled; document any mode where `Secure` is intentionally disabled.
- Enforce CSRF baseline for all cookie-auth mutating endpoints (`POST`/`PATCH` on session, run, replay, and client-settings APIs):
  - minimum cookie policy is `SameSite=Lax`,
  - reject mutating requests when `Origin` does not match allowed origins,
  - treat missing `Origin` on cross-site-capable clients as a reject condition unless an explicit local-only insecure mode is enabled.
- In trusted local-only insecure mode (explicit opt-in), document reduced CSRF posture and keep localhost binding as the default exposure limit.
- Require anti-CSRF tokens when deployment mode allows cross-site embedding or broader non-local exposure beyond the baseline same-site posture.
- Prefer localhost binding by default for local dev surfaces; require explicit configuration to expose beyond loopback.
- Treat client settings as session-scoped resources: only the owning session principal may read or patch its settings payload.
- Treat browser local storage values as untrusted hints; validate and clamp all settings on server write paths before persisting or applying.

## Operational considerations

- Emit structured logs for each turn: run ID, turn ID, loop phase, checkpoint ID, drift class.
- Capture latency at proposal, oracle round-trip, reconcile, and checkpoint boundaries.
- Define health checks for server event streaming and oracle process bridge.
- Version contracts and include version in event envelopes for compatibility.
- Align with v1 observed behavior by documenting runtime security modes:
  - HTTPS mode (default) with self-signed/local cert support for development.
  - Insecure HTTP mode only as explicit opt-in with reduced cookie protection.
- Keep endpoint-level security checks deterministic for QA:
  - baseline mode: verify `SameSite`, `Origin` validation, and session principal authorization on each mutating route family,
  - expanded exposure mode: verify anti-CSRF token enforcement in addition to baseline checks.
- Keep a clear operator note that session identity and replay/checkpoints are different concerns (session cookie does not by itself imply resumable game state).
- Distinguish settings scope from model execution scope: session-level UI/planner settings can vary per session while shared model backend capacity may remain process-level.

## Reliability and recovery

- Use bounded retry policy per phase (`act`, `think`, `test`, `chaos`, `disorder`) with escalation.
- Persist replay-critical data before emitting terminal run outcomes.
- Expose explicit run stop/cancel semantics to avoid orphaned sessions.
- Make session lifecycle semantics explicit (for example, process-memory sessions may reset on server restart unless persistent session storage is added).
- Enforce session transaction semantics:
  - each run mutation is atomic (commit complete turn state or roll back),
  - turn sequence is strictly ordered per session,
  - checkpoint writes are consistent with the committed turn,
  - idempotency keys prevent duplicate mutation on retries.

## Observability UX requirements

- Console visual remains primary interaction view.
- State/actor panels must map directly to runtime event IDs.
- Drift/reconcile outcomes should be visible in timeline form, not hidden in debug logs only.
