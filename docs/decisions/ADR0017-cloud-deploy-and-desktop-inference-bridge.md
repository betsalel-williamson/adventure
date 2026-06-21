# ADR0017: Cloud deploy MVP and desktop inference bridge

## Context

The monorepo today targets **local multi-process dev**: adventure-v2 HTTP+SSE, LangGraph assist-server, optional NL dashboard, and SLM/LLM calls that often assume **localhost** (`OLLAMA_URL`, `browserPlanner`, MLX on Apple Silicon). There is **no** documented cloud topology, **no** unified stateless inference contract across assist / NL / v2 cognition, and **no** secure path for a **hosted webclient** to use **local SLM execution** on a researcher’s machine.

Product goal for the first cloud slice:

- **Hosted backend:** game execution (Fortran oracle), session management, agent/assist services (LangGraph assist; AG2 deferred), static webclient.
- **Stateless inference:** orchestration and context providers assemble **`system` + `user`** prompts; models do not own game truth.
- **Optional local SLM:** a **desktop inference agent** connects **outbound** to the server and executes inference locally (Ollama; MLX on desktop only).
- **Secure sessions:** browser authenticates to the game server; desktop authenticates with device credentials; server **relays** inference — no vendor keys or `localhost:11434` in the public web page.

Forces:

- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) defines logical `system` / `user` requests; [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md) makes browser-direct vendors the NL dashboard default — **unsafe for public deploy**.
- [ADR0016](ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md) separates **Mind (glue)** vs **Body (execution)**; cloud MVP adds **Inference (local or hosted compute)** as a third leg.
- adventure-v2 [security-and-ops](../architecture/adventure-v2/security-and-ops.md) already describes session principals, HTTPS, and CSRF baselines — cloud deploy must extend, not bypass, these.

## Decision

1. **Layered runtime (cloud MVP):**
   - **Execution:** v2 `RunCoordinator` + Fortran oracle + SSE; optional NL engine path later.
   - **Agent / assist:** assist-server (LangGraph cartographer + navigator); AG2 handoff **out of MVP**.
   - **Orchestration:** XState / nl-glue / control machines build context and decide when to call inference — unchanged responsibility.
   - **Inference:** stateless **`InferenceRequest` → `InferenceResponse`** (see [inference contract](../architecture/cloud-deploy-mvp/inference-contract.md)); fulfilled by **hosted API**, **server-side Ollama**, or **paired desktop agent**.

2. **Desktop inference bridge:** Ship a small **desktop agent** that:
   - Maintains an **outbound WebSocket** (or equivalent) to the game server.
   - Authenticates with a **device identity** (key material in OS keychain).
   - Accepts relayed `{ system, user, schemaMode, mode }` jobs only from the authenticated server channel.
   - Calls local Ollama (MVP); MLX remains desktop-only, not cloud Linux.

3. **Pairing:** Bootstrap via **short-lived pairing code** (device authorization pattern). Long-lived credentials live on the **desktop only**. The webclient receives a **capability flag** (paired device available), not shared secrets for local inference.

4. **Public webclient:** Static build served behind HTTPS reverse proxy on the same origin as APIs where possible. Production path **must not** rely on `browserPlanner` exposing API keys to the page.

5. **Documentation and tracking:** Architecture shards under [`docs/architecture/cloud-deploy-mvp/`](../architecture/cloud-deploy-mvp/overview.md) and a **GitHub issue work graph** ([`work-graph.md`](../architecture/cloud-deploy-mvp/work-graph.md)) define MVP scope and dependency order.

## Alternatives considered

- **Browser → user localhost Ollama** — Rejected for hosted UI: wrong security model, CORS, and `127.0.0.1` refers to the visitor’s machine.
- **SLM only on cloud VM** — Valid for demos but does not satisfy “running local” or MLX; kept as parallel **hosted inference** path, not a replacement for the desktop bridge.
- **Firebase / serverless functions** — Rejected for MVP: long-lived SSE, Fortran subprocess, and native SQLite do not fit; prefer container VM (see architecture overview).
- **Single monolithic “AI server”** — Rejected: repeats Mind/Body confusion ADR0016 fixes; inference stays stateless and separate from oracle truth.

## Consequences

**Positive**

- Clear deploy story for langgraph + v2 + webclient with optional local SLM.
- One inference contract can unify assist navigator, NL planner, and future v2 `ModelAdapter`.
- Desktop holds Ollama/MLX secrets; cloud holds game sessions only.

**Negative**

- New moving parts: relay service, pairing UX, desktop app distribution.
- Server sees full inference prompts on relay path (acceptable for research MVP; document retention policy).
- Two orchestration frameworks (XState NL, LangGraph assist) remain until converged — out of scope for MVP.

## Rationale

Cloud value requires **hosted execution + UI** while preserving **local model research**. Mediated desktop inference matches the stateless `system + user` model and avoids exposing keys in the browser. Container VM deploy aligns with Fortran + SSE + multi-service Node layout already used in local dev.

## Status

Proposed

## References

- [Cloud deploy MVP — overview](../architecture/cloud-deploy-mvp/overview.md)
- [Cloud deploy MVP — work graph](../architecture/cloud-deploy-mvp/work-graph.md)
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) · [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md) · [ADR0016](ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md)
- [adventure-v2 security and ops](../architecture/adventure-v2/security-and-ops.md)
- [Webclient backend adapters](../features/webclient/backend-adapters.md)
