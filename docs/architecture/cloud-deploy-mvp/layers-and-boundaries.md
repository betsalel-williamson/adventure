# Cloud deploy MVP — layers and boundaries

Four layers. Only the bottom inference layer talks to SLM/LLM vendors. Everything above supplies context and control.

## Layer map

| Layer | Owns | Does not own | Packages (today) |
| --- | --- | --- | --- |
| **Execution** | Oracle text, run sessions, SSE fanout, GETIN / turns | Prompt assembly, model choice | `adventure-v2/apps/server`, Fortran `./adventure` |
| **Orchestration** | When to plan, interpret, act; phase escalation; guards | Vendor wire format, oracle truth | v2 `packages/control`, NL `autoplayCognitionMachine`, assist LangGraph graph |
| **Context** | Transcript slices, draft map, session memory, vocab, packaging profiles | Calling models directly (prod) | `@adventure-nl/nl-glue`, `@adventure-langgraph/map-core` |
| **Inference** | `system` + `user` → JSON/text | Game state, cookies, Fortran | Future unified relay; today: assist `SlmAdapter`, NL `TextLlm`, `browserPlanAutoplay` |

## Agent systems in MVP

| System | Role in cloud MVP | Notes |
| --- | --- | --- |
| **LangGraph assist-server** | Draft map merge + navigator hints | Calls inference relay instead of env-local `OLLAMA_URL` when paired or hosted SLM configured |
| **adventure-ag2** | Out of MVP | Handoff stub; no cloud wiring in first slice |
| **NL autoplay (XState + nl-glue)** | Post-MVP hosted path | MVP may use assist-only SLM; full NL cloud orchestration follows inference contract + session auth |

## Orchestration vs inference (NL example)

Today (local dashboard default):

1. SSE delivers oracle text → **AutoplaySessionMemory** updates context.
2. **XState** (`autoplayCognitionMachine`) triggers planning.
3. **nl-glue** builds `{ system, user }`.
4. Browser calls Gemini/Ollama via **`browserPlanner`** — **not** acceptable for public cloud.

Target (cloud + optional desktop SLM):

1. Same steps 1–3 in browser or server orchestrator.
2. **POST `/inference/plan`** (or relay enqueue) with logical request only.
3. Server routes to **hosted LLM API** (server-held key) or **paired desktop agent** (local Ollama).
4. Guards + engine input unchanged.

## Assist path (langgraph)

Today: assist-server embeds Ollama prompt inside `createOllamaSlmAdapter`.

Target: navigator node calls the same **inference contract** with `mode: "navigator"`. Context providers (`map-core` merge) supply `user` payload; system prompt is stable policy text.

## Session management

- **Game session:** v2 run id + session principal; NL `adventure_session` cookie pattern for dashboard path.
- **Pairing session:** binds `deviceId` to user/session; desktop WSS authenticated separately.
- **Inference delegation:** game session may request `localInference: true` only when a paired device is online for that principal.

See [adventure-v2 security and ops](../adventure-v2/security-and-ops.md) for HTTPS, CSRF, and session transaction baselines.

## Previous / next

- Previous: [overview](./overview.md)
- Next: [inference contract](./inference-contract.md)
