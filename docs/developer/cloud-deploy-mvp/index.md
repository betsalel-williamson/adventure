# Cloud deploy MVP — maintainer index

Operator and implementer entry for the hosted deployment slice.

Architecture shards: [`docs/architecture/cloud-deploy-mvp/`](../../architecture/cloud-deploy-mvp/overview.md)

Decision record: [ADR0017](../../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)

Work tracking: [work graph](../../architecture/cloud-deploy-mvp/work-graph.md) · [issue templates](../../architecture/cloud-deploy-mvp/github-issues.md) · [GitHub Project](./github-project.md) · [TDD workflow](../tdd-and-github-workflow.md) · [issue triage](../work-registry/issue-triage.md)

**Milestone:** [Cloud deploy MVP](https://github.com/betsalel-williamson/adventure/milestone/1) · **Epic:** [#3](https://github.com/betsalel-williamson/adventure/issues/3) · **Project:** [#3](https://github.com/users/betsalel-williamson/projects/3)

## What we are building

| Component | MVP responsibility |
| --- | --- |
| **Reverse proxy** | TLS, static webclient, route `/api/game`, `/api/assist`, `/inference` |
| **adventure-v2 server** | Runs, turns, SSE, Fortran oracle subprocess |
| **assist-server** | Draft map + navigator; calls inference relay |
| **Inference relay** | Session-scoped HTTP + desktop WSS registry |
| **Desktop agent** | Outbound WSS, local Ollama, pairing |
| **Session layer** | Principals, pairing codes, no keys in browser |

## Local dev vs cloud

Local dev today: `adventure-langgraph` `npm start` (5174 + 8787 + 8790). Cloud MVP packages the same **logical** services behind one HTTPS origin.

Do **not** use `browserPlanner` or `OLLAMA_URL=127.0.0.1` in production web builds — see [desktop inference bridge](../../architecture/cloud-deploy-mvp/desktop-inference-bridge.md).

**Target operator platform:** [Oracle Cloud Always Free](./oracle-cloud-setup.md) (single VM + Docker). Automate with [OpenTofu + GitHub Actions](./infrastructure-as-code.md) (`infra/oci/`). C2 adds HTTPS and the static webclient on the same instance.

## Implementation status

| Area | Status |
| --- | --- |
| Architecture + ADR | Documented |
| OCI infra (OpenTofu) | **Validated** — `us-phoenix-1` · [IaC guide](./infrastructure-as-code.md) · [`infra/oci/`](../../../infra/oci/) |
| Docker / C1 image | [#7](https://github.com/betsalel-williamson/adventure/issues/7) · [container guide](./container.md) |
| Inference OpenAPI | Done — [#5](https://github.com/betsalel-williamson/adventure/issues/5) I1 (PR #69) |
| Session auth | Done — [#6](https://github.com/betsalel-williamson/adventure/issues/6) S1 (PR #70) |
| Relay + desktop agent | Not started — [#9](https://github.com/betsalel-williamson/adventure/issues/9) I4, [#10](https://github.com/betsalel-williamson/adventure/issues/10) I5 |
| Pairing | Not started — [#13](https://github.com/betsalel-williamson/adventure/issues/13) I8 |
| E2E smoke | Not started — [#14](https://github.com/betsalel-williamson/adventure/issues/14) E1 |

## Related maintainer docs

- [Container image (C1)](./container.md)
- [Oracle Cloud setup](./oracle-cloud-setup.md) — OCI Always Free operator guide
- [Infrastructure as code](./infrastructure-as-code.md) — OpenTofu + GitHub Actions
- [GitHub Actions setup](./github-actions-setup.md) — secrets, deploy workflow, smoke test
- [Webclient dev setup](../webclient-dev-setup.md)
- [v3 dev setup](../v3-dev-setup.md)
- [TDD + GitHub workflow](../tdd-and-github-workflow.md)
- [Issue triage catalog](../work-registry/issue-triage.md)
- [Agent work-item tracking](../agent-work-item-tracking.md)
- [GitHub Project management](./github-project.md)
