# Cloud deploy MVP — security and session

Extends [adventure-v2 security and ops](../adventure-v2/security-and-ops.md) for hosted deployment and the desktop inference bridge.

## Security modes

| Mode | Default | Behavior |
| --- | --- | --- |
| **HTTPS (production)** | Yes for cloud | Session cookies include `Secure`; TLS terminates at reverse proxy or platform load balancer |
| **Insecure HTTP (local only)** | Opt-in via `ADV_V2_INSECURE_HTTP=1` | Drops `Secure` on session cookies; bind to loopback; document reduced CSRF posture |
| **No browser planner** | Required in production | Do not ship `browserPlanner` / direct vendor keys in hosted web builds; inference goes through server `/inference/*` relay ([inference-contract](./inference-contract.md)) |

Operator checklist:

- Set `ADV_V2_CORS_ORIGINS` to hosted web origin(s) — never `*` in production.
- Keep model/provider secrets in server env only ([mvp-scope](./mvp-scope.md)).
- Pairing codes are bootstrap-only; long-lived credentials live in desktop keychain, not browser storage.
- Session idle TTL: `ADV_V2_SESSION_IDLE_TTL_MS` (default 10 min, minimum 5 min).

## Session principal

Each browser session is an opaque principal identified by an `HttpOnly` cookie (`adv_v2_session`).

| Route | Auth |
| --- | --- |
| `POST /session` | Public — creates principal + cookie |
| `POST /pairing/codes` | Session cookie |
| `POST /inference/plan`, `POST /inference/navigator`, `GET /inference/capabilities` | Session cookie |
| Run/replay routes | Session scoping planned in follow-up (v2 baseline is open dev shell) |

Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` unless `ADV_V2_INSECURE_HTTP=1`.

**Idle timeout:** if the browser session has no authenticated activity for **10 minutes** (configurable `ADV_V2_SESSION_IDLE_TTL_MS`, minimum 5 minutes), the server revokes the session cookie principal and deletes its pairing codes and registered desktop devices. Any cookie-auth request after idle expiry receives **401**; the client must call `POST /session` again.

Activity that refreshes idle TTL: `POST /pairing/codes`, `POST /inference/plan`, `POST /inference/navigator`, `GET /inference/capabilities`. Successful `POST /pairing/redeem` also refreshes the bound web session.

Implementation: `adventure-v2/apps/server/src/session/sessionStore.ts`.

## Pairing and device tokens

Flow matches [desktop-inference-bridge](./desktop-inference-bridge.md):

1. Webclient obtains session via `POST /session`.
2. Settings UI calls `POST /pairing/codes` → 6–8 character code, ~5 minute TTL, single use.
3. Desktop app calls `POST /pairing/redeem` with the code → receives `deviceId` + `deviceToken` **once**.
4. Desktop stores `deviceToken` in **OS keychain only**; server stores a SHA-256 hash in the device registry.
5. Future outbound WSS (I4) authenticates with `Authorization: Bearer <deviceToken>`.

Contracts: `adventure-v2/packages/contracts/src/session/contract.ts` · OpenAPI paths under `/session` and `/pairing/*`.

## Controls summary (S1)

| Control | Default / behavior |
| --- | --- |
| Session id | UUID v4; server-side membership check |
| Pairing code TTL | 5 minutes; single use |
| Pairing redeem rate limit | 30 attempts / minute / client IP → 429 |
| Session idle TTL | 10 minutes; revokes session + pairing + devices |
| Browser Origin check | When `ADV_V2_CORS_ORIGINS` set; exempt desktop redeem |
| Device token at rest | SHA-256 hash; constant-time compare on validation |

Red-team regression: `adventure-v2/tests/session-auth.redteam.test.ts`.

## Security reviews

Point-in-time analysis (before/after, feasible attacks, accepted risks) lives in **[security-reviews/](./security-reviews/)** — committed, immutable records.

| Date | Review |
| --- | --- |
| 2026-06-21 | [S1 session auth + pairing](./security-reviews/2026-06-21-s1-session-auth.md) |

Process: [security review workflow](../../developer/security-review-workflow.md).

## Previous / next

- Previous: [desktop inference bridge](./desktop-inference-bridge.md)
- Next: [MVP scope](./mvp-scope.md)
