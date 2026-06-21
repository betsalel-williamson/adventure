# Security review — S1 Session auth + pairing foundation

## Metadata

| Field | Value |
| --- | --- |
| **Date** | 2026-06-21 |
| **Work key** | S1 |
| **Issue** | [#6 — session auth + pairing token foundation](https://github.com/betsalel-williamson/adventure/issues/6) |
| **PR** | [#70](https://github.com/betsalel-williamson/adventure/pull/70) |
| **Branch** | `cloud-deploy/s1-session-auth` |

## Threat model

- **Assets:** Browser session principal (`adv_v2_session` cookie); short-lived pairing codes; desktop device bearer tokens; server-side device registry (hashed tokens).
- **Actors:** Anonymous internet client; paired desktop agent; same-origin browser user; hypothetical attacker with network access to public API.
- **Trust boundaries:** Browser ↔ game server (HTTPS, cookies); desktop ↔ game server (`POST /pairing/redeem`, future WSS); server in-memory session store (MVP).
- **Out of scope:** OAuth/accounts; persistent session store; cluster-wide rate limits; game `runId` lifecycle tied to session idle (RunCoordinator remains separate); XSS in webclient; TLS termination configuration.

## Method

- OWASP [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — session id entropy, cookie flags, idle timeout.
- OWASP [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — throttle auth endpoints, constant-time secret compare.
- OWASP CSRF guidance — `SameSite`, Origin validation (aligned with [adventure-v2 security-and-ops](../adventure-v2/security-and-ops.md)).
- Red-team tests: `adventure-v2/tests/session-auth.redteam.test.ts`, `sessionCrypto.test.ts`.
- Functional tests: `adventure-v2/tests/session-auth.test.ts`.

## Findings

| # | OWASP area | Attack | Feasible? | Hole (before) | Fix (after) | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Session Management | Forge session cookie (random UUID) | Attempt yes, **success no** | Cookie accepted only if id in server store | Unchanged — already blocked | `rejects forged session cookie` |
| 2 | Session Management | Brute-force session UUID online | **No** | N/A | N/A — ~2¹²² space | entropy math in red-team test |
| 3 | Session Management | Cross-session access without cookie theft | **No** | Sessions isolated by id | Unchanged | separate cookies per `POST /session` |
| 4 | Session Management | Idle session + resources forever | **Yes** | No idle TTL; pairing/devices linger | 10 min idle TTL (`ADV_V2_SESSION_IDLE_TTL_MS`, min 5 min); `revokeSession` drops codes + devices | `revokes idle session after inactivity` |
| 5 | Authentication | Unlimited `POST /pairing/redeem` guesses | **Yes** | No rate limit | Sliding window 30/min/IP → **429** | `blocks unbounded pairing redeem attempts` |
| 6 | Authentication | Guess 6-char code within one 5 min TTL | **No** at default rate | Small code space (~30 bits) | Rate limit + TTL bounds online search | entropy math in red-team test |
| 7 | CSRF | Cross-site POST with victim cookie | **No** (modern browsers) | — | `SameSite=Lax` on session cookie | documented; not feasible with Lax |
| 8 | CSRF | Wrong `Origin` + stolen cookie when allowlist set | **Yes** (defense in depth) | CORS headers only; no Origin reject | `requireAllowedBrowserOrigin` on browser routes when `ADV_V2_CORS_ORIGINS` set | `rejects cookie-auth browser route when Origin is not allowlisted` |
| 9 | CSRF | Desktop redeem blocked by Origin check | N/A | — | **`POST /pairing/redeem` exempt** (no browser Origin) | `allows desktop pairing redeem without Origin` |
| 10 | Cryptographic storage | Timing leak on device token digest | **Theoretical** | `===` compare + linear scan | `timingSafeEqual` + hash-indexed map + dummy compare on miss | `sessionCrypto.test.ts` |
| 11 | Session Management | XSS read session cookie | Mitigated | — | `HttpOnly` cookie flag | `sets HttpOnly on session cookie` |
| 12 | Information disclosure | Distinguish unknown vs used pairing code (404 vs 410) | Low impact | Different status codes | **Accepted** — aids UX; no credential leak | — |

## Accepted risks

| Risk | Rationale | Follow-up |
| --- | --- | --- |
| In-memory session store | MVP skeleton; lost on restart | Persistent store with C2/I4 deploy |
| Rate limit per process IP | Single-node MVP; no Redis | Shared limiter when horizontally scaled |
| Game runs not tied to session idle | RunCoordinator keyed by `runId` | Scope run cleanup to session in follow-up |
| 6-character pairing codes | Matches architecture; sufficient with rate limit + TTL | Revisit if operator threat model tightens |
| Device token validation does not extend browser idle TTL | Prevents desktop agent keeping dead browser session alive | By design in `validateDeviceToken` |

## Follow-ups

- [ ] Tie oracle/run lifecycle to session principal or idle timeout (epic #3 / later execution issue).
- [ ] Persistent session + device registry for multi-instance deploy (I4/C2).
- [ ] Re-review when `POST /pairing/redeem` moves behind mTLS or device attestation.

## Related

- [security-and-session.md](../security-and-session.md) — living spec
- [security review workflow](../../../developer/security-review-workflow.md)
- [QA report template](../../../developer/qa-verification-report.md) — functional evidence (`.caches/qa-reports/`, gitignored)
