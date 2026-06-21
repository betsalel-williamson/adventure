#!/usr/bin/env bash
# Smoke-test a running C1 container: v2 /health (Fortran oracle) + assist /assist/health.
set -euo pipefail

V2_BASE="${1:-http://127.0.0.1:8787}"
ASSIST_BASE="${2:-http://127.0.0.1:8790}"
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

echo "Container smoke OK · v2 oracle=${oracle_mode} · assist status=${assist_status}"
