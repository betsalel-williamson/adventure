# Cloud deploy MVP — scope

## In scope (first ship)

### Hosted runtime

- Container (or VM) image: **Node 24**, **gfortran**, `./adventure` + `adventure.dat`
- Processes: **adventure-v2 server** (8787), **assist-server** (8790)
- **Reverse proxy** (nginx or Caddy): TLS, static **webclient** build, proxy `/api/game`, `/api/assist`, `/inference`
- **Session baseline:** HTTPS, session principal on mutating routes (extend v2 security checklist)
- **CORS / single origin** where UI and API share host

### Play path

- Webclient (or langgraph web initially) against **v2-http** + **langgraph assist**
- CRT + SSE + draft exploration map
- Heuristic navigator when no inference backend configured

### Inference

- Unified [inference contract](./inference-contract.md) (OpenAPI + types)
- **Server relay** with desktop WSS registry
- **Desktop agent MVP:** Ollama only, outbound WSS
- **Pairing** flow (short-lived code)
- **Hosted cloud LLM** path: server-held Gemini or HTTP key for `/inference/*` without `browserPlanner`

### Documentation

- [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)
- This shard set + [work graph](./work-graph.md)
- GitHub Issues linked as implementation DAG

## Out of scope (explicit)

| Item | Reason |
| --- | --- |
| adventure-ag2 cloud wiring | Research stub; Python bridge not ready |
| Full NL dashboard cloud parity | Browser SQLite, subsystem replica, MLX — separate milestone |
| MLX on cloud Linux VM | Apple Silicon local only; use desktop bridge |
| `browserPlanner` keys in public page | Replaced by server relay |
| Firebase / multi-region / autoscale | Single VM MVP |
| Production auth (OAuth, accounts) | Session + pairing only; document insecure-mode limits |
| Execution MCP stdio (ADR0016 C4) | IDE path; not deploy blocker |
| v2 real ModelAdapter in cognition graph | Stub remains; navigator uses assist path first |

## Acceptance (MVP done when)

1. Operator deploys one image to a VM; HTTPS URL serves webclient.
2. Player completes a run: start run → turns → SSE transcript → map updates.
3. Researcher pairs desktop; navigator or planner uses **local Ollama** via relay without browser localhost calls.
4. Operator can disable desktop and use **hosted LLM** env for inference instead.
5. No API keys in webclient build artifacts.

## Previous / next

- Previous: [desktop inference bridge](./desktop-inference-bridge.md)
- Next: [work graph](./work-graph.md)
