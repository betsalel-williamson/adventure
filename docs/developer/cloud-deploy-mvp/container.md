# Cloud deploy MVP — container image (C1)

Docker image bundling **adventure-v2** (Fortran oracle), **assist-server**, and runtime deps for hosted MVP deploy. Reverse proxy and static webclient are [#8 C2](https://github.com/betsalel-williamson/adventure/issues/8).

Issue: [#7 C1](https://github.com/betsalel-williamson/adventure/issues/7)

## Image contents

| Service | Default port | Health |
| --- | ---: | --- |
| adventure-v2 HTTP API | **8787** | `GET /health` |
| assist-server | **8790** | `GET /assist/health` |

Both processes run in one container via [`scripts/cloud-deploy/container-entrypoint.sh`](../../../scripts/cloud-deploy/container-entrypoint.sh). The v2 server auto-detects the built `./adventure` Fortran binary at repo root (`oracleMode: process`).

## Build and run

```bash
# Single platform (local / CI) — bake git SHA into /health for smoke validation
docker build $(./scripts/cloud-deploy/docker-build-args.sh) -t adventure-cloud .

docker run --rm -p 8787:8787 -p 8790:8790 adventure-cloud

# Multi-arch (linux/amd64 + linux/arm64)
docker buildx build $(./scripts/cloud-deploy/docker-build-args.sh) --platform linux/amd64,linux/arm64 -t adventure-cloud .
```

`GET /health` and `GET /assist/health` include build metadata: `version`, `gitSha`, `imageTag`, and `builtAt`.

- **CI / local builds** — `imageTag` and `gitSha` both use the git commit SHA.
- **Release deploy** — `imageTag` is the semver (e.g. `0.2.0`); `gitSha` is the release commit SHA.

Smoke test against a running container:

```bash
./scripts/cloud-deploy/container-smoke.sh
# CI / SHA-tagged local build:
ADV_EXPECTED_IMAGE_TAG="$(git rev-parse HEAD)" ./scripts/cloud-deploy/container-smoke.sh
# Release / semver on production VM:
./scripts/cloud-deploy/container-smoke.sh http://141.148.173.150:8787 http://141.148.173.150:8790 0.2.0
```

## Environment variables

| Variable | Service | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | adventure-v2 | **8787** | Game API listen port |
| `HOST` | adventure-v2 | **0.0.0.0** | Game API bind address |
| `ASSIST_SERVER_PORT` | assist-server | **8790** | Assist HTTP listen port |
| `OLLAMA_URL` | assist-server | *(unset)* | When set, assist uses Ollama instead of heuristic adapter |
| `OLLAMA_MODEL` | assist-server | `llama3.2` | Ollama model name |
| `ASSIST_PROBE_ENABLED` | assist-server | `false` | Allow `advance: true` on `/assist/step` |
| `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE` | adventure-v2 | *(unset)* | Set to `1` to force synthetic oracle (dev/test only) |
| `ADV_V2_PROCESS_ORACLE_SCRIPT` | adventure-v2 | *(unset)* | Explicit process oracle script path |
| `ADV_BUILD_GIT_SHA` | both | `dev` | Git commit baked at image build (see `docker-build-args.sh`) |
| `ADV_BUILD_IMAGE_TAG` | both | same as `ADV_BUILD_GIT_SHA` | Deploy tag / SHA echoed in `/health` |
| `ADV_BUILD_TIME` | both | *(unset)* | UTC ISO timestamp when the image was built |

Production cloud deploy must **not** set `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1` — the image builds `./adventure` so Fortran mode is the default.

Session and inference env from S1 apply to v2 as documented in [security and session](../../architecture/cloud-deploy-mvp/security-and-session.md).

## CI and production deploy

| Workflow | When | What |
| --- | --- | --- |
| **`cloud-deploy-c1`** ([`adventure.yml`](../../../.github/workflows/adventure.yml)) | **Push to `feature/adventure-llm` only** | Build image + local `container-smoke.sh` (SHA tags) — not on PR branches |
| **`changesets.yml`** ([`changesets.yml`](../../../.github/workflows/changesets.yml)) | Version Packages PR merge | Git tag + GitHub Release → calls **`oci-deploy`** |
| **`oci-deploy`** ([`oci-deploy.yml`](../../../.github/workflows/oci-deploy.yml)) | Release (auto) or manual dispatch | Build, push OCIR (`:semver` + `:latest`), SSH deploy, full smoke suite |

Release deploy runs only when the **Version Packages** PR merges (not every feature PR). Manual hotfix: **Actions → oci-deploy**. See [environments](./environments.md) and [GitHub Actions setup](./github-actions-setup.md).

Docker build context excludes secrets via [`.dockerignore`](../../../.dockerignore) (`terraform.tfvars`, `.env`, `*.pem`, etc.).

## Related

- [Cloud deploy maintainer index](./index.md)
- [Environments (production)](./environments.md)
- [Oracle Cloud setup](./oracle-cloud-setup.md)
- [Work graph — C1](../../architecture/cloud-deploy-mvp/work-graph.md)
- [assist-server maintainer docs](../readme-adventure-langgraph-assist-server/index.md)
