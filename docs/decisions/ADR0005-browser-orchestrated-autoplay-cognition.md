# ADR0005: Browser-orchestrated autoplay cognition loop

## Context

### User needs and motivations

- **Researchers and power users** want to **change how the game is driven** (memory, heuristics, prompt structure) **without** redeploying or restarting the Node dashboard.
- **Developers** want a clear split: the backend runs the **game binary** and **model connections**; the **policy** that decides the next command lives where it can be iterated quickly (browser) and versioned (subsystem store — see other ADRs).

### Technical context

Today `runAutoplaySessionWithTextLlm` in `autoplayRunner.ts` orchestrates Fortran I/O, `AutoplaySessionMemory`, prompt building, and LLM calls in one Node process. That couples iteration speed to server lifecycle.

**Extra network hop:** The new path adds **SSE (server → client)** for game text, then **HTTP (client → server)** for each logical LLM call. **LLM time-to-first-token** usually dominates; still, avoid **chatty** cognitive substeps on the hot path. Prefer a **single long-lived** HTTP connection (keep-alive / same session) and consider **batching** multiple logical requests when the subsystem design requires several model calls before the next GETIN.

## Decision

- Move the **orchestration loop** for the web dashboard to the **browser**: a state machine that consumes **streamed game text** (SSE), updates client-side cognition state, builds **logical** LLM requests, sends GETIN via existing session APIs, and calls packaging-backed LLM endpoints ([ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)).
- Keep **Fortran subprocess** and **SSE** delivery on the server; do not move the `adventure` binary to WASM in this program.

## Alternatives considered

- **Keep full orchestration on the server** — Rejected for web UX goals (dynamic policy changes without restart); may remain for CLI (`cli/main.ts`) until explicitly migrated.
- **WebWorker-only cognition** — Deferred: same logical split as main thread; can migrate later for heavy work.

## Consequences

**Positive**

- Subsystem edits can affect the next move without Node reload.
- Clear seam for tests: mock SSE + mock LLM logical API.

**Negative**

- Larger client bundle; more client-side state to debug.
- Session reconnect semantics must be defined (game state vs cognition state).
- Additional **RTT** per LLM round-trip vs colocated server loop; mitigate by batching and by measuring (LLM latency ≫ typical localhost RTT for dev).

## Rationale

Orchestration is **policy**; the user asked to iterate policy in the front end. Engine I/O stays server-side for security and binary execution.

## Status

Proposed

## References

- `adventure-llm/src/cli/autoplayRunner.ts`
- `adventure-llm/src/cli/webDashboard.ts`
- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md)
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)
