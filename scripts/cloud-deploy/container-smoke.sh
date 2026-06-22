#!/usr/bin/env bash
# Smoke-test a running C1 container: v2 /health (Fortran oracle) + assist /assist/health.
# Validates build metadata (version, gitSha, imageTag) when ADV_EXPECTED_IMAGE_TAG is set
# or passed as the 3rd argument.
set -euo pipefail

V2_BASE="${1:-http://127.0.0.1:8787}"
ASSIST_BASE="${2:-http://127.0.0.1:8790}"
EXPECTED_TAG="${ADV_EXPECTED_IMAGE_TAG:-${3:-}}"

MAX_WAIT="${CONTAINER_SMOKE_TIMEOUT:-90}"

wait_for_url() {
  local url="$1"
  local elapsed=0
  while [ "$elapsed" -lt "$MAX_WAIT" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "Timed out after ${MAX_WAIT}s waiting for $url" >&2
  return 1
}

require_health_field() {
  local json="$1"
  local field="$2"
  local label="$3"
  local value
  value="$(echo "$json" | jq -r ".${field} // empty")"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "Missing ${field} in ${label} /health response" >&2
    echo "$json" >&2
    exit 1
  fi
  printf '%s' "$value"
}

wait_for_url "${V2_BASE}/health"
wait_for_url "${ASSIST_BASE}/assist/health"

v2_json="$(curl -sf "${V2_BASE}/health")"
assist_json="$(curl -sf "${ASSIST_BASE}/assist/health")"

oracle_mode="$(echo "$v2_json" | jq -r '.oracleMode')"
if [ "$oracle_mode" != "process" ]; then
  echo "Expected v2 oracleMode=process (Fortran), got: ${oracle_mode}" >&2
  echo "$v2_json" >&2
  exit 1
fi

assist_status="$(echo "$assist_json" | jq -r '.status')"
if [ "$assist_status" != "ok" ]; then
  echo "Expected assist status=ok, got: ${assist_status}" >&2
  echo "$assist_json" >&2
  exit 1
fi

v2_version="$(require_health_field "$v2_json" "version" "v2")"
v2_git_sha="$(require_health_field "$v2_json" "gitSha" "v2")"
v2_image_tag="$(require_health_field "$v2_json" "imageTag" "v2")"

assist_version="$(require_health_field "$assist_json" "version" "assist")"
assist_git_sha="$(require_health_field "$assist_json" "gitSha" "assist")"
assist_image_tag="$(require_health_field "$assist_json" "imageTag" "assist")"

if [ "$v2_image_tag" != "$assist_image_tag" ]; then
  echo "v2/assist imageTag mismatch: ${v2_image_tag} vs ${assist_image_tag}" >&2
  exit 1
fi

if [ "$v2_git_sha" != "$assist_git_sha" ]; then
  echo "v2/assist gitSha mismatch: ${v2_git_sha} vs ${assist_git_sha}" >&2
  exit 1
fi

if [ -n "$EXPECTED_TAG" ] && [ "$v2_image_tag" != "$EXPECTED_TAG" ]; then
  echo "Deployed imageTag ${v2_image_tag} does not match expected ${EXPECTED_TAG}" >&2
  echo "v2: $v2_json" >&2
  echo "assist: $assist_json" >&2
  exit 1
fi

echo "Container smoke OK · v2 ${v2_version}@${v2_image_tag} (git ${v2_git_sha}) · assist ${assist_version}@${assist_image_tag} · oracle=${oracle_mode}"
