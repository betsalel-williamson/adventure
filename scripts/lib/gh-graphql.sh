#!/usr/bin/env bash
# Shared GitHub API helpers: rate-limit awareness, throttle, retry, wait-or-quit.
# Source from migration/sync scripts: source "$(dirname "$0")/../lib/gh-graphql.sh"
set -euo pipefail

GH_GRAPHQL_FLOOR="${GH_GRAPHQL_FLOOR:-100}"
GH_SYNC_DELAY_SEC="${GH_SYNC_DELAY_SEC:-2}"
GH_SYNC_READ_DELAY_SEC="${GH_SYNC_READ_DELAY_SEC:-0.5}"
GH_RETRY_MAX="${GH_RETRY_MAX:-5}"
GH_RATE_LIMIT_EXIT="${GH_RATE_LIMIT_EXIT:-42}"
_GH_LAST_CALL_MS=0

# wait = sleep until reset and continue; quit = exit with resume timestamp; ask = prompt on TTY
gh_init_rate_limit_policy() {
  if [[ -n "${GH_RATE_LIMIT_POLICY:-}" ]]; then
    return 0
  fi
  if [[ -t 0 ]]; then
    GH_RATE_LIMIT_POLICY=ask
  else
    GH_RATE_LIMIT_POLICY=quit
  fi
  export GH_RATE_LIMIT_POLICY
}

gh_graphql_status() {
  gh api rate_limit --jq '.resources.graphql' 2>/dev/null || echo '{"remaining":0,"limit":5000,"reset":0}'
}

gh_graphql_remaining() {
  gh_graphql_status | jq -r '.remaining // 0'
}

gh_graphql_reset_epoch() {
  gh_graphql_status | jq -r '.reset // 0'
}

gh_format_reset_local() {
  local reset="${1:-$(gh_graphql_reset_epoch)}"
  date -r "$reset" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null \
    || date -d "@$reset" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null \
    || echo "epoch $reset"
}

gh_seconds_until_reset() {
  local reset now wait_sec
  reset="$(gh_graphql_reset_epoch)"
  now="$(date +%s)"
  wait_sec=$((reset - now + 5))
  if [[ "$wait_sec" -lt 1 ]]; then
    wait_sec=60
  fi
  echo "$wait_sec"
}

gh_print_quota_status() {
  local remaining limit reset local_time wait_sec floor
  remaining="$(gh_graphql_remaining)"
  limit="$(gh_graphql_status | jq -r '.limit // 5000')"
  reset="$(gh_graphql_reset_epoch)"
  local_time="$(gh_format_reset_local "$reset")"
  wait_sec="$(gh_seconds_until_reset)"
  floor="${GH_GRAPHQL_FLOOR:-100}"
  cat >&2 <<EOF
GraphQL quota: ${remaining}/${limit} remaining · resets at (local): ${local_time} · ~${wait_sec}s
EOF
  if [[ "$remaining" -eq 0 ]]; then
    echo "Quota exhausted. Safe to resume after: ${local_time}" >&2
  elif [[ "$remaining" -lt "$floor" ]]; then
    echo "Quota below floor (${floor}). Will pause until reset at: ${local_time}" >&2
  fi
}

gh_print_rate_limit_resume() {
  local reset local_time wait_sec remaining
  reset="$(gh_graphql_reset_epoch)"
  local_time="$(gh_format_reset_local "$reset")"
  wait_sec="$(gh_seconds_until_reset)"
  remaining="$(gh_graphql_remaining)"
  cat >&2 <<EOF

GraphQL rate limit exhausted (remaining=$remaining).
Resume at (local time): $local_time
Wait approximately: ${wait_sec}s

Re-run the same command with --resume to continue from the ledger (no duplicate work).

EOF
}

gh_wait_for_rate_limit_clear() {
  local attempt="${1:-1}"
  local wait_sec reset now remaining local_time

  remaining="$(gh_graphql_remaining)"
  if [[ "$remaining" -gt 0 ]]; then
    local backoff=$((60 * (2 ** (attempt - 1))))
    if [[ "$backoff" -gt 300 ]]; then backoff=300; fi
    echo "Secondary rate limit suspected (remaining=$remaining). Backoff ${backoff}s (attempt $attempt)..." >&2
    sleep "$backoff"
    return 0
  fi

  reset="$(gh_graphql_reset_epoch)"
  local_time="$(gh_format_reset_local "$reset")"
  wait_sec="$(gh_seconds_until_reset)"
  echo "Primary GraphQL rate limit hit. Waiting ${wait_sec}s until reset at ${local_time} (attempt $attempt)..." >&2
  sleep "$wait_sec"
}

# Returns 0 to retry the failed command; exits GH_RATE_LIMIT_EXIT on quit.
gh_handle_rate_limit_exhaustion() {
  gh_init_rate_limit_policy
  gh_print_rate_limit_resume

  case "$GH_RATE_LIMIT_POLICY" in
    wait)
      local_time="$(gh_format_reset_local)"
      wait_sec="$(gh_seconds_until_reset)"
      echo "Policy=wait: sleeping until ${local_time} (~${wait_sec}s)..." >&2
      sleep "$wait_sec"
      gh_print_quota_status
      return 0
      ;;
    quit)
      gh_hint_stale_cache
      exit "$GH_RATE_LIMIT_EXIT"
      ;;
    ask)
      if [[ ! -t 0 ]]; then
        gh_hint_stale_cache
        exit "$GH_RATE_LIMIT_EXIT"
      fi
      local choice
      while true; do
        read -r -p "Wait until $(gh_format_reset_local) and continue? [Y/wait/quit] " choice
        case "${choice:-Y}" in
          Y|y|wait|w|"")
            local_time="$(gh_format_reset_local)"
            wait_sec="$(gh_seconds_until_reset)"
            echo "Waiting until ${local_time} (~${wait_sec}s)..." >&2
            sleep "$wait_sec"
            gh_print_quota_status
            return 0
            ;;
          q|quit|Q|n|N)
            echo "Stopped. Re-run with --resume when quota is available." >&2
            gh_hint_stale_cache
            exit "$GH_RATE_LIMIT_EXIT"
            ;;
          *)
            echo "Enter Y to wait, or quit to stop." >&2
            ;;
        esac
      done
      ;;
    *)
      echo "Unknown GH_RATE_LIMIT_POLICY=$GH_RATE_LIMIT_POLICY (use wait|quit|ask)" >&2
      exit "$GH_RATE_LIMIT_EXIT"
      ;;
  esac
}

gh_wait_if_low() {
  local floor="${1:-$GH_GRAPHQL_FLOOR}"
  local remaining reset now wait_sec local_time
  remaining="$(gh_graphql_remaining)"
  if [[ "$remaining" -ge "$floor" ]]; then
    return 0
  fi
  reset="$(gh_graphql_reset_epoch)"
  local_time="$(gh_format_reset_local "$reset")"
  now="$(date +%s)"
  wait_sec=$((reset - now + 5))
  if [[ "$wait_sec" -lt 1 ]]; then
    wait_sec=60
  fi
  echo "GraphQL quota low (remaining=$remaining). Waiting ${wait_sec}s until reset at ${local_time}..." >&2
  sleep "$wait_sec"
}

gh_is_rate_limited_output() {
  local out="$1"
  echo "$out" | grep -qiE 'rate limit exceeded|secondary rate limit|API rate limit|abuse detection'
}

gh_hint_stale_cache() {
  cat >&2 <<'HINT'

If gh keeps reporting rate limits but `gh api rate_limit` shows quota available,
clear stale cached responses (https://github.com/cli/cli/issues/12812):

  grep -rl 'X-Ratelimit-Remaining: 0' ~/.cache/gh/ 2>/dev/null | xargs rm -f

HINT
}

gh_throttle() {
  local kind="${1:-mutation}"
  local delay_ms now elapsed target_ms
  if [[ "$kind" == "read" ]]; then
    target_ms="$(awk "BEGIN { printf \"%.0f\", ${GH_SYNC_READ_DELAY_SEC} * 1000 }")"
  else
    target_ms="$(awk "BEGIN { printf \"%.0f\", ${GH_SYNC_DELAY_SEC} * 1000 }")"
  fi
  now="$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s000)"
  elapsed=$((now - _GH_LAST_CALL_MS))
  if [[ "$elapsed" -lt "$target_ms" ]]; then
    sleep "$(awk "BEGIN { printf \"%.3f\", ($target_ms - $elapsed) / 1000 }")"
  fi
  _GH_LAST_CALL_MS="$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s000)"
}

# gh_retry <read|mutation> -- command [args...]
gh_retry() {
  local kind="mutation"
  if [[ "${1:-}" == "read" || "${1:-}" == "mutation" ]]; then
    kind="$1"
    shift
  fi
  if [[ "${1:-}" != "--" ]]; then
    echo "gh_retry: expected '--' before command" >&2
    return 1
  fi
  shift

  local attempt=1
  local output exit_code

  while true; do
    gh_wait_if_low
    gh_throttle "$kind"

    set +e
    output="$("$@" 2>&1)"
    exit_code=$?
    set -e

    if [[ "$exit_code" -eq 0 ]] && ! gh_is_rate_limited_output "$output"; then
      echo "$output"
      return 0
    fi

    if gh_is_rate_limited_output "$output"; then
      echo "$output" >&2
      if [[ "$attempt" -lt "$GH_RETRY_MAX" ]]; then
        gh_wait_for_rate_limit_clear "$attempt"
        attempt=$((attempt + 1))
        continue
      fi
      echo "gh_retry: max attempts ($GH_RETRY_MAX) exceeded for rate limit" >&2
      gh_handle_rate_limit_exhaustion
      attempt=1
      continue
    fi

    echo "$output" >&2
    return "$exit_code"
  done
}

gh_require_project_scope() {
  if ! gh auth status 2>&1 | grep -q 'project'; then
    echo "Missing gh project scope. Run:" >&2
    echo "  gh auth refresh -h github.com -s project,read:project" >&2
    exit 1
  fi
}
