# Cloud deploy MVP — desktop inference bridge

## Problem

Hosted webclient cannot call `http://127.0.0.1:11434` on the player’s machine. Researchers still need **local Ollama or MLX** without exposing inference ports to the internet.

## Pattern

A **desktop inference agent** maintains an **outbound** connection to the hosted server. The server **relays** stateless inference jobs; the desktop executes them against local runtimes.

```text
Browser ──HTTPS──► Game server ──WSS (outbound from desktop)──► Desktop agent ──► Ollama
                         │
                         └── never exposes Ollama port publicly
```

## Desktop agent responsibilities (MVP)

| In scope | Out of scope |
| --- | --- |
| Outbound WSS to server | Hosting Fortran / game SSE |
| Device keypair in OS keychain | Running XState autoplay loop (optional future) |
| `InferenceRequest` → local Ollama → `InferenceResponse` | Arbitrary filesystem or shell tools |
| Health: provider list, model id, latency | MLX in MVP optional stretch (Mac only) |

## Pairing flow (MVP)

1. User signs into hosted webclient (session cookie issued by game server — auth mechanism TBD in session issue).
2. Webclient **Settings → Connect local SLM** shows a **6–8 character code**, TTL ~5 minutes.
3. Desktop app: enter code (or scan QR later).
4. Server binds `deviceId` ↔ session principal; desktop receives **refresh token** stored in keychain only.
5. Webclient shows **Local SLM: connected** via `GET /inference/capabilities`.

Long-lived **shared secrets in the browser are not used**. Pairing code is one-time bootstrap only.

## Security properties (target)

| Property | Approach |
| --- | --- |
| No inbound home firewall rules | Desktop connects outbound |
| Least privilege | Relay accepts inference jobs only, scoped to paired principal |
| Revocation | Server drops device registration; desktop reconnect requires re-pair |
| Audit | `requestId`, `deviceId`, `mode`, duration logged server-side |

Prompt content is visible to the relay server — acceptable for research MVP; document retention in operator runbook (future shard).

## Webclient agent backend

Extend [backend adapters](../../features/webclient/backend-adapters.md) with a planned value:

| Value | Behavior |
| --- | --- |
| `inference-relay` (name TBD) | Orchestration calls server `/inference/*`; server routes to desktop or hosted provider |

Distinct from:

- `nl-glue-browser` — direct vendor calls (local dev only)
- `nl-glue-server` — Node TextLlm pool (MLX server path)

## Failure modes

| Condition | UX |
| --- | --- |
| Desktop offline | Fall back to hosted LLM if configured, else heuristic navigator (assist) |
| Inference timeout | Orchestration surfaces error; does not stall oracle SSE |
| Pairing expired | Prompt re-pair; no silent retry with stale code |

## Previous / next

- Previous: [inference contract](./inference-contract.md)
- Next: [security and session](./security-and-session.md)
