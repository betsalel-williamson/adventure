# Cloud deploy MVP — environments

Single hosted environment today (no dev/staging/prod split). Values come from OpenTofu outputs and GitHub secrets — **refresh IP from `tofu output -raw instance_public_ip` after VM recreate**; values below may be stale.

## Production

| Field | Value |
| --- | --- |
| Name | `production` |
| GitHub environment | [production](https://github.com/betsalel-williamson/adventure/deployments/activity_log?environments_filter=production) |
| VM public IP | `141.148.173.150` (`tofu output -raw instance_public_ip` from [`infra/oci/`](../../../infra/oci/)) |
| Game API | `http://141.148.173.150:8787` |
| Game health | `GET /health` → `version`, `imageTag`, `gitSha`, `oracleMode` |
| Assist API | `http://141.148.173.150:8790` |
| Assist health | `GET /assist/health` |
| OCIR image | `{region}.ocir.io/<namespace>/adventure-cloud:<semver>` (OCIR only — not GHCR) |
| Deploy trigger | Merge **Version Packages** PR → `changesets.yml` → `oci-deploy` |
| Player HTTPS URL | Pending [#8 C2](https://github.com/betsalel-williamson/adventure/issues/8) |

### What is live today (C1)

The VM runs the **C1 container** (adventure-v2 + assist-server on ports 8787/8790). There is **no static webclient on the VM** until C2 — use the langgraph CRT shell locally pointed at these APIs, or curl for operator smoke.

### Read deployed version

```bash
curl -sf http://141.148.173.150:8787/health | jq '{version, imageTag, gitSha, oracleMode}'
curl -sf http://141.148.173.150:8790/assist/health | jq '{version, imageTag, gitSha, status}'
```

After a release deploy, `imageTag` matches the semver OCIR tag (e.g. `0.2.0`); `gitSha` is the release commit SHA.

### Post-deploy smoke (operator)

From repo root (requires Node 24+, network to VM):

```bash
export OCI_DEPLOY_HOST=141.148.173.150
export ADV_EXPECTED_IMAGE_TAG=0.2.0   # optional — assert /health imageTag

# Health only
./scripts/cloud-deploy/container-smoke.sh \
  "http://${OCI_DEPLOY_HOST}:8787" \
  "http://${OCI_DEPLOY_HOST}:8790" \
  "$ADV_EXPECTED_IMAGE_TAG"

# Full suite (health + API E2E + headless Playwright CRT)
./scripts/cloud-deploy/run-post-deploy-smoke.sh
```

CI runs the same suite in [`.github/workflows/oci-deploy.yml`](../../../.github/workflows/oci-deploy.yml) after each release deploy.

Manual hotfix deploy: **Actions → oci-deploy → Run workflow** (optional `image_tag` or `semver` inputs).

## What runs when

| Stage | Trigger | CI / CD |
| --- | --- | --- |
| Feature PR | Open PR to `feature/adventure-llm` | Package tests, docs-check, changeset-check — no OCIR push |
| Default push | Merge feature PR | `cloud-deploy-c1` builds image locally (SHA tag) + smoke |
| Release | Merge **Version Packages** PR | `changesets.yml` → git tag + GitHub Release → `oci-deploy` → OCIR `:semver` + VM restart + full smoke |
| Hotfix | Manual **oci-deploy** dispatch | Operator-chosen semver or SHA tag |

Release merge skips `cloud-deploy-c1` (commit message `chore(release): …`) because `oci-deploy` builds and validates the production image.

## Rollback

To redeploy a previous known-good semver without reverting git history:

1. **Actions → oci-deploy → Run workflow**
2. Set **semver** to the last good version (e.g. `0.2.0`)
3. Confirm `/health` shows matching `imageTag` and post-deploy smoke is green

OCIR retains prior semver tags until you delete them in the console.

## Related

- [Cloud deploy maintainer index](./index.md)
- [GitHub Actions setup](./github-actions-setup.md)
- [Container (C1)](./container.md)
- [Infrastructure as code](./infrastructure-as-code.md)
