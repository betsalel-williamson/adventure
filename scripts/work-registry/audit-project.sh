#!/usr/bin/env bash
# Read-only audit: compare GitHub Project #3 to work-registry manifest + ledger.
set -euo pipefail

# Read-only: use remaining quota without waiting for full reset unless exhausted.
export GH_GRAPHQL_FLOOR="${GH_GRAPHQL_FLOOR:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=project-state.sh
source "$SCRIPT_DIR/project-state.sh"

PROGRAM_FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --program) PROGRAM_FILTER="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--program <id>]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

OWNER="$(jq -r '.project.owner' "$MANIFEST")"
PROJECT_NUM="$(jq -r '.project.number' "$MANIFEST")"
REPO="$(jq -r '.project.repo' "$MANIFEST")"
REPO_SLUG="$OWNER/$REPO"

gh_require_project_scope
ledger_init

gh_print_quota_status

load_project_id
load_fields_cache
load_items_cache

echo "=== Project ==="
gh_retry read -- gh project view "$PROJECT_NUM" --owner "$OWNER" --format json \
  | jq '{title, number, url, itemCount: .items.totalCount}'

echo ""
echo "=== Field option coverage ==="
for field in Program "Work key" Phase; do
  have="$(field_option_names "$field" | wc -l | tr -d ' ')"
  case "$field" in
    Program) want="$(collect_programs | wc -l | tr -d ' ')" ;;
    "Work key") want="$(collect_work_keys | wc -l | tr -d ' ')" ;;
    Phase) want="$(collect_phases | wc -l | tr -d ' ')" ;;
  esac
  echo "$field: $have/$want options on board"
  missing="$(missing_field_options "$field" $(case "$field" in
    Program) collect_programs ;;
    "Work key") collect_work_keys ;;
    Phase) collect_phases ;;
  esac) | head -5)"
  if [[ -n "$missing" ]]; then
    echo "  missing (first 5):"
    echo "$missing" | sed 's/^/    /'
  fi
done

echo ""
echo "=== Membership + ledger ==="
audit_project_gaps

echo ""
echo "=== Items needing work ==="
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  program_id="$(echo "$row" | jq -r '.programId')"
  program_filter_match "$PROGRAM_FILTER" "$program_id" || continue
  work_key="$(echo "$row" | jq -r '.workKey')"
  key="${program_id}::${work_key}"
  issue_num="$(ledger_get "$key" issue)"
  [[ -z "$issue_num" ]] && issue_num="$(echo "$row" | jq -r '.issue // empty')"
  [[ -z "$issue_num" ]] && continue

  local_item="$(project_item_id_for_issue_num "$issue_num")"
  sync_done="$(ledger_get "$key" syncStatus)"

  if [[ -z "$local_item" ]]; then
    echo "ADD: #$issue_num $key"
  elif [[ "$sync_done" != "done" ]]; then
    echo "FIELDS: #$issue_num $key (on board as $local_item)"
  fi
done < <(manifest_all_items)

echo ""
echo "Run sync: ./scripts/work-registry/sync-github-project.sh --resume --auto-wait"
