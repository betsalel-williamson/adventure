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
# Single platform (local / CI)
docker build -t adventure-cloud .

docker run --rm -p 8787:8787 -p 8790:8790 adventure-cloud

# Multi-arch (linux/amd64 + linux/arm64)
docker buildx build --platform linux/amd64,linux/arm64 -t adventure-cloud .
```

Smoke test against a running container:

```bash
./scripts/cloud-deploy/container-smoke.sh
# or custom bases:
./scripts/cloud-deploy/container-smoke.sh http://127.0.0.1:8787 http://127.0.0.1:8790
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

Production cloud deploy must **not** set `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1` — the image builds `./adventure` so Fortran mode is the default.

Session and inference env from S1 apply to v2 as documented in [security and session](../../architecture/cloud-deploy-mvp/security-and-session.md).

## CI and production deploy

| Workflow | When | What |
| --- | --- | --- |
| **`cloud-deploy-c1`** ([`adventure.yml`](../../../.github/workflows/adventure.yml)) | Every PR / push | Build image + `container-smoke.sh` |
| **`oci-deploy`** ([`oci-deploy.yml`](../../../.github/workflows/oci-deploy.yml)) | Manual dispatch | Build, push OCIR, SSH `docker pull` on VM |

Use **`oci-deploy`** for all deploys to the OCI VM after infra is up. See [GitHub Actions setup](./github-actions-setup.md).

Docker build context excludes secrets via [`.dockerignore`](../../../.dockerignore) (`terraform.tfvars`, `.env`, `*.pem`, etc.).

## Related

- [Cloud deploy maintainer index](./index.md)
- [Oracle Cloud setup](./oracle-cloud-setup.md)
- [Work graph — C1](../../architecture/cloud-deploy-mvp/work-graph.md)
- [assist-server maintainer docs](../readme-adventure-langgraph-assist-server/index.md)
