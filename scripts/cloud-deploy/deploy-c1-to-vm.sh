#!/usr/bin/env bash
# BOOTSTRAP ONLY — one-time local deploy before CI/OCIR is configured.
#
# Production deploys: GitHub Actions → oci-deploy (build, push OCIR, SSH pull).
# See docs/developer/cloud-deploy-mvp/github-actions-setup.md
#
# This script builds locally, uploads a docker save tarball (no repo/rsync), and
# smoke-tests. It does NOT sync terraform.tfvars or other secrets — docker build
# uses .dockerignore; only the image archive is scp'd to the VM.
#
# Requires explicit opt-in (prevents accidental use after bootstrap):
#   ADVENTURE_ALLOW_LOCAL_DEPLOY=1 ./scripts/cloud-deploy/deploy-c1-to-vm.sh
# SSH key path: infra/oci/secrets/github-secrets.env (SSH_PRIVATE_KEY_PATH)
#
# Prerequisites:
#   - infra/oci applied; admin_cidr in terraform.tfvars matches your current IPv4
#   - SSH private key matching ssh_public_key in terraform.tfvars (~/.ssh/oci_key)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS_FILE="${REPO_ROOT}/infra/oci/secrets/github-secrets.env"
SSH_KEY=""
SSH_USER="ubuntu"
PLATFORM="${ADVENTURE_DOCKER_PLATFORM:-linux/amd64}"
REMOTE_TAR="/tmp/adventure-cloud.tar.gz"

expand_path() {
  local p="$1"
  case "$p" in
    "~/"*) printf '%s' "${HOME}/${p#~/}" ;;
    "~") printf '%s' "$HOME" ;;
    *) printf '%s' "$p" ;;
  esac
}

usage() {
  echo "Usage: ADVENTURE_ALLOW_LOCAL_DEPLOY=1 $0 [--host IP] [--platform linux/amd64|linux/arm64]"
  echo "       SSH key: SSH_PRIVATE_KEY_PATH in infra/oci/secrets/github-secrets.env"
  echo ""
  echo "Bootstrap only. For ongoing deploys use: Actions → oci-deploy"
  exit 1
}

HOST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --ssh-private-key)
      echo "Error: --ssh-private-key removed — set SSH_PRIVATE_KEY_PATH in $SECRETS_FILE"
      exit 1
      ;;
    --host) HOST="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --build-on-vm)
      echo "Error: --build-on-vm was removed (it rsync'd the full repo including tfvars)."
      echo "Use GitHub Actions → oci-deploy, or bootstrap with this script (image tarball only)."
      exit 1
      ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1"; usage ;;
  esac
done

if [ "${ADVENTURE_ALLOW_LOCAL_DEPLOY:-}" != "1" ]; then
  echo "Error: local VM deploy is disabled by default."
  echo ""
  echo "  Production: GitHub Actions → oci-deploy"
  echo "  Docs: docs/developer/cloud-deploy-mvp/github-actions-setup.md"
  echo ""
  echo "  One-time bootstrap only:"
  echo "    ADVENTURE_ALLOW_LOCAL_DEPLOY=1 $0"
  exit 1
fi

if [ -z "$SSH_KEY" ] && [ -f "$SECRETS_FILE" ]; then
  _ssh_line="$(grep -E '^[[:space:]]*SSH_PRIVATE_KEY_PATH[[:space:]]*=' "$SECRETS_FILE" | head -1 | sed -E 's/^[^=]+=[[:space:]]*//')"
  _ssh_line="${_ssh_line#\"}"; _ssh_line="${_ssh_line%\"}"
  SSH_KEY="$(expand_path "$_ssh_line")"
fi

[ -n "$SSH_KEY" ] || {
  echo "Missing SSH key. Copy infra/oci/secrets.example → infra/oci/secrets and set SSH_PRIVATE_KEY_PATH."
  exit 1
}
[ -f "$SSH_KEY" ] || { echo "SSH key not found: $SSH_KEY"; exit 1; }

if [ -z "$HOST" ]; then
  HOST="$(cd "${REPO_ROOT}/infra/oci" && tofu output -raw instance_public_ip)"
fi

# Keepalive avoids "Connection reset by peer" on long transfers
SSH_BASE=(-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=120)
SSH_OPTS=(-C "${SSH_BASE[@]}" -i "$SSH_KEY" "${SSH_USER}@${HOST}")
SCP_OPTS=(-C "${SSH_BASE[@]}" -i "$SSH_KEY")

ensure_vm_swap() {
  ssh "${SSH_OPTS[@]}" 'if ! swapon --show | grep -q /swapfile; then
    echo "Adding 2G swap (E2.Micro needs this for docker load)..."
    sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
    sudo mkswap /swapfile && sudo swapon /swapfile
  fi
  free -h'
}

echo "=== Preflight (bootstrap deploy — prefer oci-deploy for production) ==="
CURRENT_IP="$(curl -4 -s ifconfig.me)"
echo "Your IPv4: ${CURRENT_IP} (must match admin_cidr in terraform.tfvars)"
echo "VM: ${HOST} · build platform: ${PLATFORM}"

echo "=== Prepare VM (swap) ==="
ensure_vm_swap

echo "=== Build image (repo root; secrets excluded via .dockerignore) ==="
echo "Note: linux/amd64 on Apple Silicon uses QEMU — first build may take several minutes."
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
# shellcheck disable=SC2046
docker build --platform "${PLATFORM}" $( "${REPO_ROOT}/scripts/cloud-deploy/docker-build-args.sh" "$GIT_SHA" "$GIT_SHA" ) -t adventure-cloud:local "${REPO_ROOT}"

ARCH="$(docker image inspect adventure-cloud:local --format '{{.Architecture}}')"
echo "Built image architecture: ${ARCH}"

LOCAL_TAR="$(mktemp /tmp/adventure-cloud-XXXXXX.tar.gz)"
cleanup() { rm -f "$LOCAL_TAR"; }
trap cleanup EXIT

echo "=== Save image locally (gzip) ==="
docker save adventure-cloud:local | gzip -1 > "$LOCAL_TAR"
echo "Archive: $(du -h "$LOCAL_TAR" | awk '{print $1}')"

echo "=== Upload to VM (scp — image only, no repo files) ==="
echo "Expect several minutes on E2.Micro..."
scp "${SCP_OPTS[@]}" "$LOCAL_TAR" "${SSH_USER}@${HOST}:${REMOTE_TAR}"

echo "=== docker load on VM ==="
ssh "${SSH_OPTS[@]}" "gunzip -c ${REMOTE_TAR} | docker load && rm -f ${REMOTE_TAR}"

echo "=== Start container ==="
ssh "${SSH_OPTS[@]}" \
  'docker rm -f adventure 2>/dev/null || true; docker run -d --name adventure --restart unless-stopped -p 8787:8787 -p 8790:8790 adventure-cloud:local'

echo "=== Smoke test ==="
sleep 5
ADV_EXPECTED_IMAGE_TAG="$GIT_SHA" "${REPO_ROOT}/scripts/cloud-deploy/container-smoke.sh" \
  "http://${HOST}:8787" "http://${HOST}:8790"

echo "Deploy OK · http://${HOST}:8787/health"
echo ""
echo "Next: configure OCIR secrets and use Actions → oci-deploy for all future deploys."
