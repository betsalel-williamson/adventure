#!/usr/bin/env bash
# Full post-deploy smoke: health, functional API, headless Playwright.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${OCI_DEPLOY_HOST:?Set OCI_DEPLOY_HOST to the VM public IP}"
TAG="${ADV_EXPECTED_IMAGE_TAG:-}"

"$ROOT/scripts/cloud-deploy/container-smoke.sh" \
  "http://${HOST}:8787" \
  "http://${HOST}:8790" \
  "$TAG"

export OCI_DEPLOY_HOST="$HOST"
export ADV_V2_BASE="http://${HOST}:8787"
export ADV_ASSIST_BASE="http://${HOST}:8790"
export ADV_EXPECTED_IMAGE_TAG="$TAG"
node --import tsx "$ROOT/scripts/cloud-deploy/remote-api-smoke.mts"

export VITE_API_URL="$ADV_V2_BASE"
export VITE_ASSIST_URL="$ADV_ASSIST_BASE"
"$ROOT/scripts/cloud-deploy/run-playwright-smoke.sh"
