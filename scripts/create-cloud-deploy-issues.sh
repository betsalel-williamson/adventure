#!/usr/bin/env bash
# DEPRECATED: use scripts/work-registry/migrate-to-github.sh --program cloud-deploy-mvp --resume
# Create cloud-deploy-mvp GitHub issues from docs/architecture/cloud-deploy-mvp/work-graph.md
# Idempotent: skips if EPIC issue title already exists.
set -euo pipefail

echo "WARNING: This script is deprecated. Use:" >&2
echo "  ./scripts/work-registry/migrate-to-github.sh --resume --program cloud-deploy-mvp" >&2
echo "  ./scripts/work-registry/sync-github-project.sh --resume --program cloud-deploy-mvp" >&2
echo "" >&2

REPO="betsalel-williamson/adventure"
BASE="https://github.com/betsalel-williamson/adventure/blob/main/docs"

existing_epic="$(gh issue list --repo "$REPO" --label epic --search "cloud-deploy-mvp hosted backend" --json number --jq '.[0].number // empty')"
if [[ -n "$existing_epic" ]]; then
  echo "Epic already exists: #$existing_epic — aborting (delete or rename to recreate)."
  exit 1
fi

create() {
  local title="$1"
  local body="$2"
  shift 2
  gh issue create --repo "$REPO" --title "$title" --body "$body" "$@"
}

EPIC_URL=$(create "cloud-deploy-mvp: hosted backend + webclient + desktop SLM bridge (epic)" "$(cat <<EOF
## Summary

Epic for the **cloud deploy MVP**: hosted adventure-v2 + assist-server + static webclient, session security, unified stateless inference (\`system\` + \`user\`), optional **desktop inference agent** for local Ollama.

## Architecture

- [Cloud deploy MVP overview](${BASE}/architecture/cloud-deploy-mvp/overview.md)
- [Work graph](${BASE}/architecture/cloud-deploy-mvp/work-graph.md)
- [ADR0017](${BASE}/decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)

## Child work graph keys

| Key | Area |
| --- | --- |
| D0 | Documentation |
| I1 | Inference OpenAPI contract |
| S1 | Session auth + pairing |
| C1 | Container image |
| C2 | Reverse proxy + webclient |
| I4 | Inference relay |
| I5 | Desktop agent |
| I6 | Hosted cloud LLM |
| I7 | Assist via relay |
| I8 | Pairing flow |
| E1 | E2E smoke |

## Acceptance

See [mvp-scope.md](${BASE}/architecture/cloud-deploy-mvp/mvp-scope.md).
EOF
)" --label cloud-deploy-mvp --label epic)

EPIC=$(echo "$EPIC_URL" | grep -oE '[0-9]+$')
echo "Created epic #$EPIC"

D0=$(create "cloud-deploy-mvp (D0): ADR0017 + architecture shards + work graph" "$(cat <<EOF
## Objective

Land architecture documentation and ADR for cloud deploy MVP + desktop inference bridge.

## Acceptance criteria

- [x] [ADR0017](${BASE}/decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md) merged
- [x] Shards under \`docs/architecture/cloud-deploy-mvp/\` complete
- [x] [work-graph.md](${BASE}/architecture/cloud-deploy-mvp/work-graph.md) lists issue DAG
- [x] Cross-links from architecture overview, features, developer index, glossary
- [ ] GitHub issue templates in `.github/ISSUE_TEMPLATE/`
- [x] Live issue numbers in [work-graph.md](https://github.com/betsalel-williamson/adventure/blob/main/docs/architecture/cloud-deploy-mvp/work-graph.md) (epic [#3](https://github.com/betsalel-williamson/adventure/issues/3))

## Dependencies

- Epic: #${EPIC}
- Blocks: (documentation baseline for I1, S1, C1)
EOF
)" --label cloud-deploy-mvp) && D0=$(echo "$D0" | grep -oE '[0-9]+$')

I1=$(create "cloud-deploy-mvp (I1): unified inference OpenAPI + shared types" "$(cat <<EOF
## Objective

Define stateless \`InferenceRequest\` / \`InferenceResponse\` (system + user + mode) in OpenAPI and shared Zod/TS types.

## Acceptance criteria

- [ ] OpenAPI paths: \`POST /inference/plan\`, \`POST /inference/navigator\`, \`GET /inference/capabilities\`
- [ ] Types align with [inference-contract.md](${BASE}/architecture/cloud-deploy-mvp/inference-contract.md) and \`PlannerUserPromptInput\` in nl-glue
- [ ] CI drift check for spec (pattern: adventure-v2 \`openapi:check\`)

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${D0}
- Blocks: (I4, I5, I6, I7 — link when created)
EOF
)" --label cloud-deploy-mvp) && I1=$(echo "$I1" | grep -oE '[0-9]+$')

S1=$(create "cloud-deploy-mvp (S1): session auth + pairing token foundation" "$(cat <<EOF
## Objective

Session principal for mutating routes; short-lived pairing codes; device registration model. Extend v2 security baselines for HTTPS deploy.

## Acceptance criteria

- [ ] Document security modes for cloud (HTTPS default, no browserPlanner in prod)
- [ ] Pairing code issue + redeem API skeleton (TTL, single use)
- [ ] Device token storage contract (desktop keychain; server registry)
- [ ] Session principal checks on \`/inference/*\` mutating routes

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${D0}
- References: [security-and-ops](${BASE}/architecture/adventure-v2/security-and-ops.md), [desktop-inference-bridge](${BASE}/architecture/cloud-deploy-mvp/desktop-inference-bridge.md)
EOF
)" --label cloud-deploy-mvp) && S1=$(echo "$S1" | grep -oE '[0-9]+$')

C1=$(create "cloud-deploy-mvp (C1): container image — v2 + Fortran + assist-server" "$(cat <<EOF
## Objective

Dockerfile (linux/arm64 + amd64): Node 24, gfortran, \`make adventure\`, adventure-v2 server, assist-server.

## Acceptance criteria

- [ ] Image builds in CI
- [ ] v2 \`/health\` and assist \`/assist/health\` respond
- [ ] Fortran oracle mode works in container (not synthetic-only)
- [ ] Env documented for ports 8787 / 8790

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${D0}
- Blocks: (C2 — link when created)
EOF
)" --label cloud-deploy-mvp) && C1=$(echo "$C1" | grep -oE '[0-9]+$')

C2=$(create "cloud-deploy-mvp (C2): reverse proxy + static webclient deploy" "$(cat <<EOF
## Objective

nginx/Caddy: TLS, static webclient build, proxy to v2 + assist on same origin.

## Acceptance criteria

- [ ] \`npm run build\` webclient served at \`/\`
- [ ] \`VITE_*\` URLs point at proxied paths (single origin)
- [ ] SSE works through proxy (buffering off, timeouts)
- [ ] CORS allowlist documented for operator

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${C1}
EOF
)" --label cloud-deploy-mvp) && C2=$(echo "$C2" | grep -oE '[0-9]+$')

I4=$(create "cloud-deploy-mvp (I4): server inference relay (HTTP + desktop WSS registry)" "$(cat <<EOF
## Objective

HTTP handlers for \`/inference/*\`; WebSocket endpoint for desktop agents; route jobs to online paired device or hosted provider.

## Acceptance criteria

- [ ] Implements I1 OpenAPI
- [ ] Desktop outbound WSS auth with device token
- [ ] Timeout + error envelope when no device online
- [ ] No vendor keys returned to browser

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${I1} #${S1}
EOF
)" --label cloud-deploy-mvp) && I4=$(echo "$I4" | grep -oE '[0-9]+$')

I5=$(create "cloud-deploy-mvp (I5): desktop inference agent (Ollama, outbound WSS)" "$(cat <<EOF
## Objective

Minimal desktop app: pairing, outbound WSS, execute I1 requests against local Ollama.

## Acceptance criteria

- [ ] Pair with server using short-lived code
- [ ] Device private key in OS keychain
- [ ] Handles \`mode: navigator | planner\` for Ollama JSON
- [ ] Packaged for macOS first (Linux desktop optional)

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${I1} #${S1}
- References: [desktop-inference-bridge](${BASE}/architecture/cloud-deploy-mvp/desktop-inference-bridge.md)
EOF
)" --label cloud-deploy-mvp) && I5=$(echo "$I5" | grep -oE '[0-9]+$')

I6=$(create "cloud-deploy-mvp (I6): hosted cloud LLM path (server-held keys)" "$(cat <<EOF
## Objective

Server-side fulfillment of \`/inference/plan\` and \`/inference/navigator\` using Gemini or HTTP provider env — no \`browserPlanner\`.

## Acceptance criteria

- [ ] Keys only in server env / secret store
- [ ] Reuses nl-glue packaging helpers where possible
- [ ] Feature flag to disable when only desktop SLM desired

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${I1} #${S1} #${I4}
EOF
)" --label cloud-deploy-mvp) && I6=$(echo "$I6" | grep -oE '[0-9]+$')

I7=$(create "cloud-deploy-mvp (I7): assist navigator via inference relay" "$(cat <<EOF
## Objective

Refactor assist-server navigator to call \`/inference/navigator\` (in-process or HTTP) instead of direct \`OLLAMA_URL\`.

## Acceptance criteria

- [ ] Heuristic fallback unchanged when inference unavailable
- [ ] Orchestration builds system+user; Ollama prompt not hidden inside adapter
- [ ] OpenAPI assist paths unchanged for clients

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${I1} #${I4}
EOF
)" --label cloud-deploy-mvp) && I7=$(echo "$I7" | grep -oE '[0-9]+$')

I8=$(create "cloud-deploy-mvp (I8): pairing flow (web UI + API + desktop UX)" "$(cat <<EOF
## Objective

Webclient settings UI: show pairing code, connection status via \`GET /inference/capabilities\`. Desktop redeem flow.

## Acceptance criteria

- [ ] Code rotates; single redeem
- [ ] UI shows local SLM connected / offline
- [ ] Revoke pairing from web session

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${S1} #${I4} #${I5}
EOF
)" --label cloud-deploy-mvp) && I8=$(echo "$I8" | grep -oE '[0-9]+$')

E1=$(create "cloud-deploy-mvp (E1): E2E smoke — cloud play + paired or hosted SLM" "$(cat <<EOF
## Objective

Automated or scripted smoke on target VM: deploy image, play one run, verify inference path.

## Acceptance criteria

- [ ] HTTPS URL loads webclient; CRT receives SSE text
- [ ] Path A: paired desktop + local Ollama navigator hint
- [ ] Path B: hosted LLM env without desktop
- [ ] Document operator runbook in developer shard

## Dependencies

- Epic: #${EPIC}
- Blocked by: #${C2} #${I4} #${I8}
- Recommended: #${I6} #${I7}
EOF
)" --label cloud-deploy-mvp) && E1=$(echo "$E1" | grep -oE '[0-9]+$')

# Patch I1/S1/C1 with blocks references now that numbers exist
gh issue comment "$I1" --repo "$REPO" --body "Blocks: #${I4} #${I5} #${I6} #${I7}"
gh issue comment "$S1" --repo "$REPO" --body "Blocks: #${I4} #${I5} #${I6} #${I8}"
gh issue comment "$C1" --repo "$REPO" --body "Blocks: #${C2}"
gh issue comment "$I4" --repo "$REPO" --body "Blocks: #${I6} #${I7} #${I8} #${E1}"
gh issue comment "$I5" --repo "$REPO" --body "Blocks: #${I8} #${E1}"
gh issue comment "$C2" --repo "$REPO" --body "Blocks: #${E1}"
gh issue comment "$I6" --repo "$REPO" --body "Blocks: #${E1}"
gh issue comment "$I7" --repo "$REPO" --body "Blocks: #${E1}"
gh issue comment "$I8" --repo "$REPO" --body "Blocks: #${E1}"

cat <<OUT
Created cloud-deploy-mvp issues:
  EPIC=#${EPIC}
  D0=#${D0} I1=#${I1} S1=#${S1} C1=#${C1} C2=#${C2}
  I4=#${I4} I5=#${I5} I6=#${I6} I7=#${I7} I8=#${I8} E1=#${E1}
OUT
