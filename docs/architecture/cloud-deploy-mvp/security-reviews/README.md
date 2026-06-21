# Cloud deploy MVP — security reviews

Point-in-time **security review records** for hosted session, pairing, and inference surfaces. Complements the living spec in [security-and-session.md](../security-and-session.md).

## When to add a review

| Trigger | Required |
| --- | --- |
| Auth, session, pairing, device tokens, WSS | Yes |
| New public HTTP route or changed auth model | Yes |
| Crypto or secret handling change | Yes |
| Internal refactor, same threat model | No (unless red-team tests change) |

Process: [security review workflow](../../../developer/security-review-workflow.md).

## Index

| Date | Work key | Issue | Summary |
| --- | --- | --- | --- |
| 2026-06-21 | S1 | [#6](https://github.com/betsalel-williamson/adventure/issues/6) | Session auth + pairing foundation; red-team hardening + idle TTL |

## Artifact layers

| Layer | Location | Role |
| --- | --- | --- |
| Living spec | [security-and-session.md](../security-and-session.md) | Current controls and operator checklist |
| **Review record** | This directory (`YYYY-MM-DD-<work-key>.md`) | Immutable analysis: before/after, feasible vs not, accepted risks |
| Executable proof | `adventure-v2/tests/session-auth*.test.ts` | Regression + red-team tests |
| Raw evidence | `.caches/qa-reports/` (gitignored) | Optional test/live captures |

Reviews are **committed** and **immutable** after merge — update the living spec for current behavior; add a new dated review when re-auditing.

## New review template

Copy to `YYYY-MM-DD-<work-key>.md` and fill in.

```markdown
# Security review — WORK_KEY Short title

## Metadata

| Field | Value |
| --- | --- |
| **Date** | YYYY-MM-DD |
| **Work key** | e.g. S1 |
| **Issue** | [#N — title](https://github.com/…/issues/N) |
| **PR** | [#N](https://github.com/…/pull/N) |
| **Branch** | `cloud-deploy/<work-key>-<slug>` |
| **Reviewer** | name or agent session |

## Threat model

- **Assets:** …
- **Actors:** …
- **Trust boundaries:** …
- **Out of scope:** …

## Method

Checklists used (e.g. OWASP Session Management, OWASP Authentication). Red-team tests: `adventure-v2/tests/…`.

## Findings

| # | OWASP area | Attack | Feasible? | Hole (before) | Fix (after) | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | … | … | Yes / No / Theoretical | … | … | test name or rationale |

## Accepted risks

| Risk | Rationale | Follow-up issue |
| --- | --- | --- |
| … | … | … |

## Follow-ups

- [ ] …

## Related

- [security-and-session.md](../security-and-session.md)
- [security review workflow](../../../developer/security-review-workflow.md)
```
