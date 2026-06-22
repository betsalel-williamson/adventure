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
| OCIR image | `{region}.ocir.io/<namespace>/adventure-cloud:<semver>` |
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

## Related

- [Cloud deploy maintainer index](./index.md)
- [GitHub Actions setup](./github-actions-setup.md)
- [Container (C1)](./container.md)
- [Infrastructure as code](./infrastructure-as-code.md)
