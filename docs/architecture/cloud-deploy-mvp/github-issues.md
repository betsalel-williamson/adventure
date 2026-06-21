# Cloud deploy MVP — GitHub issue templates

Use when creating **new** tasks on [betsalel-williamson/adventure](https://github.com/betsalel-williamson/adventure).

## GitHub form templates (preferred)

Create issues via **New issue** → choose:

| Template | File |
| --- | --- |
| Cloud deploy MVP — epic | [`.github/ISSUE_TEMPLATE/cloud-deploy-epic.yml`](../../../.github/ISSUE_TEMPLATE/cloud-deploy-epic.yml) |
| Cloud deploy MVP — task | [`.github/ISSUE_TEMPLATE/cloud-deploy-task.yml`](../../../.github/ISSUE_TEMPLATE/cloud-deploy-task.yml) |
| General implementation task | [`.github/ISSUE_TEMPLATE/general-task.yml`](../../../.github/ISSUE_TEMPLATE/general-task.yml) |

Template chooser config: [`.github/ISSUE_TEMPLATE/config.yml`](../../../.github/ISSUE_TEMPLATE/config.yml)

Labels: `cloud-deploy-mvp`, `epic` (epic only).

## Live work graph (created)

| Key | Issue |
| --- | --- |
| EPIC | [#3](https://github.com/betsalel-williamson/adventure/issues/3) |
| D0 | [#4](https://github.com/betsalel-williamson/adventure/issues/4) |
| I1–E1 | [#5](https://github.com/betsalel-williamson/adventure/issues/5)–[#14](https://github.com/betsalel-williamson/adventure/issues/14) |

Full table: [work-graph.md](./work-graph.md). Sub-issues linked under epic #3.

Recreate script (guard if epic exists): [`scripts/create-cloud-deploy-issues.sh`](../../../scripts/create-cloud-deploy-issues.sh)

---

## Reference bodies (archive)

The sections below mirror the initial issue bodies. Prefer form templates for new work.

## Epic

**Title:** `cloud-deploy-mvp: hosted backend + webclient + desktop SLM bridge (epic)`

**Body:**

```markdown
## Summary

Epic for the **cloud deploy MVP**: hosted adventure-v2 + assist-server + static webclient, session security, unified stateless inference (`system` + `user`), optional **desktop inference agent** for local Ollama.

## Architecture

- [Cloud deploy MVP overview](./overview.md)
- [Work graph](./work-graph.md)
- [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)

## Child issues

Create sub-issues from this file; link numbers in work-graph.md.

## Acceptance

See [mvp-scope.md](./mvp-scope.md).
```

---

## D0 — Document pattern

**Title:** `cloud-deploy-mvp (D0): ADR0017 + architecture shards + work graph`

**Depends on:** —
**Blocks:** I1, S1, C1 (documentation baseline for implementers)

**Body:**

```markdown
## Objective

Land architecture documentation and ADR for cloud deploy MVP + desktop inference bridge.

## Acceptance criteria

- [ ] [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md) merged
- [ ] Shards under `docs/architecture/cloud-deploy-mvp/` complete
- [ ] [work-graph.md](./work-graph.md) lists issue DAG
- [ ] Cross-links from `docs/architecture/overview.md`, features, developer index, glossary

## References

- Epic: #EPIC
```

---

## I1 — Inference contract

**Title:** `cloud-deploy-mvp (I1): unified inference OpenAPI + shared types`

**Depends on:** D0
**Blocks:** I4, I5, I6, I7

**Body:**

```markdown
## Objective

Define stateless `InferenceRequest` / `InferenceResponse` (system + user + mode) in OpenAPI and shared Zod/TS types.

## Acceptance criteria

- [ ] OpenAPI paths: `POST /inference/plan`, `POST /inference/navigator`, `GET /inference/capabilities`
- [ ] Types align with [inference-contract.md](./inference-contract.md) and `PlannerUserPromptInput` in nl-glue
- [ ] CI drift check for spec (pattern: adventure-v2 `openapi:check`)

## References

- [inference-contract.md](./inference-contract.md)
- Epic: #EPIC
- Blocked by: #D0
- Blocks: #I4 #I5 #I6 #I7
```

---

## S1 — Session auth foundation

**Title:** `cloud-deploy-mvp (S1): session auth + pairing token foundation`

**Depends on:** D0
**Blocks:** I4, I5, I6, I8

**Body:**

```markdown
## Objective

Session principal for mutating routes; short-lived pairing codes; device registration model. Extend v2 security baselines for HTTPS deploy.

## Acceptance criteria

- [ ] Document security modes for cloud (HTTPS default, no browserPlanner in prod)
- [ ] Pairing code issue + redeem API skeleton (TTL, single use)
- [ ] Device token storage contract (desktop keychain; server registry)
- [ ] Session principal checks on `/inference/*` mutating routes

## References

- [adventure-v2/security-and-ops.md](../adventure-v2/security-and-ops.md)
- [desktop-inference-bridge.md](./desktop-inference-bridge.md)
- Epic: #EPIC
- Blocked by: #D0
- Blocks: #I4 #I5 #I6 #I8
```

---

## C1 — Container image

**Title:** `cloud-deploy-mvp (C1): container image — v2 + Fortran + assist-server`

**Depends on:** D0
**Blocks:** C2

**Body:**

```markdown
## Objective

Dockerfile (linux/arm64 + amd64): Node 24, gfortran, `make adventure`, adventure-v2 server, assist-server.

## Acceptance criteria

- [ ] Image builds in CI
- [ ] v2 `/health` and assist `/assist/health` respond
- [ ] Fortran oracle mode works in container (not synthetic-only)
- [ ] Env documented for ports 8787 / 8790

## References

- Epic: #EPIC
- Blocked by: #D0
- Blocks: #C2
```

---

## C2 — Webclient deploy

**Title:** `cloud-deploy-mvp (C2): reverse proxy + static webclient deploy`

**Depends on:** C1
**Blocks:** E1

**Body:**

```markdown
## Objective

nginx/Caddy: TLS, static webclient build, proxy to v2 + assist on same origin.

## Acceptance criteria

- [ ] `npm run build` webclient served at `/`
- [ ] `VITE_*` URLs point at proxied paths (single origin)
- [ ] SSE works through proxy (buffering off, timeouts)
- [ ] CORS allowlist documented for operator

## References

- [developer/cloud-deploy-mvp/index.md](../../developer/cloud-deploy-mvp/index.md)
- Epic: #EPIC
- Blocked by: #C1
- Blocks: #E1
```

---

## I4 — Inference relay

**Title:** `cloud-deploy-mvp (I4): server inference relay (HTTP + desktop WSS registry)`

**Depends on:** I1, S1
**Blocks:** I6, I7, I8, E1

**Body:**

```markdown
## Objective

HTTP handlers for `/inference/*`; WebSocket endpoint for desktop agents; route jobs to online paired device or hosted provider.

## Acceptance criteria

- [ ] Implements I1 OpenAPI
- [ ] Desktop outbound WSS auth with device token
- [ ] Timeout + error envelope when no device online
- [ ] No vendor keys returned to browser

## References

- [inference-contract.md](./inference-contract.md)
- Epic: #EPIC
- Blocked by: #I1 #S1
- Blocks: #I6 #I7 #I8 #E1
```

---

## I5 — Desktop agent

**Title:** `cloud-deploy-mvp (I5): desktop inference agent (Ollama, outbound WSS)`

**Depends on:** I1, S1
**Blocks:** I8, E1

**Body:**

```markdown
## Objective

Minimal desktop app: pairing, outbound WSS, execute I1 requests against local Ollama.

## Acceptance criteria

- [ ] Pair with server using short-lived code
- [ ] Device private key in OS keychain
- [ ] Handles `mode: navigator | planner` for Ollama JSON
- [ ] Packaged for macOS first (Linux desktop optional)

## References

- [desktop-inference-bridge.md](./desktop-inference-bridge.md)
- [glossary/desktop-inference-agent.md](../../glossary/desktop-inference-agent.md)
- Epic: #EPIC
- Blocked by: #I1 #S1
- Blocks: #I8 #E1
```

---

## I6 — Hosted cloud LLM

**Title:** `cloud-deploy-mvp (I6): hosted cloud LLM path (server-held keys)`

**Depends on:** I1, S1, I4
**Blocks:** E1

**Body:**

```markdown
## Objective

Server-side fulfillment of `/inference/plan` and `/inference/navigator` using Gemini or HTTP provider env — no `browserPlanner`.

## Acceptance criteria

- [ ] Keys only in server env / secret store
- [ ] Reuses nl-glue packaging helpers where possible
- [ ] Feature flag to disable when only desktop SLM desired

## References

- [ADR0015](../../decisions/ADR0015-deprecate-server-forward-nl-cognition.md)
- Epic: #EPIC
- Blocked by: #I1 #S1 #I4
- Blocks: #E1
```

---

## I7 — Assist via relay

**Title:** `cloud-deploy-mvp (I7): assist navigator via inference relay`

**Depends on:** I1, I4
**Blocks:** E1

**Body:**

```markdown
## Objective

Refactor assist-server navigator to call `/inference/navigator` (in-process or HTTP) instead of direct `OLLAMA_URL`.

## Acceptance criteria

- [ ] Heuristic fallback unchanged when inference unavailable
- [ ] Orchestration builds system+user; Ollama prompt not hidden inside adapter
- [ ] OpenAPI assist paths unchanged for clients

## References

- [layers-and-boundaries.md](./layers-and-boundaries.md)
- Epic: #EPIC
- Blocked by: #I1 #I4
- Blocks: #E1
```

---

## I8 — Pairing flow

**Title:** `cloud-deploy-mvp (I8): pairing flow (web UI + API + desktop UX)`

**Depends on:** S1, I4, I5
**Blocks:** E1

**Body:**

```markdown
## Objective

Webclient settings UI: show pairing code, connection status via `GET /inference/capabilities`. Desktop redeem flow.

## Acceptance criteria

- [ ] Code rotates; single redeem
- [ ] UI shows local SLM connected / offline
- [ ] Revoke pairing from web session

## References

- [desktop-inference-bridge.md](./desktop-inference-bridge.md)
- Epic: #EPIC
- Blocked by: #S1 #I4 #I5
- Blocks: #E1
```

---

## E1 — E2E smoke

**Title:** `cloud-deploy-mvp (E1): E2E smoke — cloud play + paired or hosted SLM`

**Depends on:** C2, I4, I8 (minimum); I6, I7 recommended

**Body:**

```markdown
## Objective

Automated or scripted smoke on target VM: deploy image, play one run, verify inference path.

## Acceptance criteria

- [ ] HTTPS URL loads webclient; CRT receives SSE text
- [ ] Path A: paired desktop + local Ollama navigator hint
- [ ] Path B: hosted LLM env without desktop
- [ ] Document operator runbook in developer shard

## References

- [mvp-scope.md](./mvp-scope.md)
- Epic: #EPIC
- Blocked by: #C2 #I4 #I8
```

---

## Bulk create (when Issues enabled)

Replace `#EPIC`, `#D0`, … with real numbers after creating the epic and children.

```bash
# Example — run from repo root after enabling Issues
gh issue create --title "cloud-deploy-mvp: ... (epic)" --body-file docs/architecture/cloud-deploy-mvp/issue-bodies/epic.md
```

See [work-graph.md](./work-graph.md) for dependency order.
