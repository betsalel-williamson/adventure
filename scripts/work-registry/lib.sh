#!/usr/bin/env bash
# Shared paths for work-registry scripts.
set -euo pipefail

WORK_REGISTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$WORK_REGISTRY_DIR/../.." && pwd)"
MANIFEST="$WORK_REGISTRY_DIR/manifest.json"
LEDGER="${WORK_REGISTRY_LEDGER:-$REPO_ROOT/.caches/work-registry-ledger.json}"

source "$REPO_ROOT/scripts/lib/gh-graphql.sh"

ledger_init() {
  mkdir -p "$(dirname "$LEDGER")"
  if [[ ! -f "$LEDGER" ]]; then
    echo '{}' >"$LEDGER"
  fi
}

ledger_get() {
  local key="$1"
  local field="${2:-issue}"
  jq -r --arg k "$key" --arg f "$field" '.[$k][$f] // empty' "$LEDGER" 2>/dev/null || true
}

ledger_set() {
  local key="$1"
  local tmp
  tmp="$(mktemp)"
  jq --arg k "$key" --argjson v "$2" '.[$k] = (.[$k] // {}) + $v' "$LEDGER" >"$tmp"
  mv "$tmp" "$LEDGER"
}

ledger_meta_get() {
  local section="$1"
  local field="${2:-}"
  if [[ -n "$field" ]]; then
    jq -r --arg s "$section" --arg f "$field" \
      '(._meta[$s][$f] // .[$s][$f] // empty)' "$LEDGER" 2>/dev/null || true
  else
    jq -r --arg s "$section" '((._meta[$s] // .[$s]) // empty)' "$LEDGER" 2>/dev/null || true
  fi
}

ledger_meta_set() {
  local section="$1"
  local json="$2"
  local tmp
  tmp="$(mktemp)"
  jq --arg s "$section" --argjson v "$json" \
    '._meta = ((._meta // {}) | .[$s] = ((._meta[$s] // .[$s] // {}) + $v)) | del(.[$s])' "$LEDGER" >"$tmp"
  mv "$tmp" "$LEDGER"
}

project_setup_done() {
  [[ "$(ledger_meta_get projectSetup status)" == "done" ]]
}

link_ledger_key() {
  echo "_link::${1}::${2}::${3}"
}

manifest_programs() {
  jq -c '.programs[]' "$MANIFEST"
}

manifest_items_for_program() {
  local program_id="$1"
  jq -c --arg p "$program_id" '
    .programs[] | select(.id == $p) | .items[]?
  ' "$MANIFEST"
}

manifest_all_items() {
  jq -c '
    .programs[] as $prog |
    ($prog.items[]? | . + {programId: $prog.id, programLabel: $prog.label, epicWorkKey: ($prog.epic.workKey // null), epicIssue: ($prog.epic.issue // null)})
  ' "$MANIFEST"
}

program_filter_match() {
  local filter="${1:-}"
  local program_id="$2"
  [[ -z "$filter" || "$filter" == "$program_id" ]]
}
