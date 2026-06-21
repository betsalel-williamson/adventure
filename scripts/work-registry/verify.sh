#!/usr/bin/env bash
# Verify work-registry migration: ledger, issues, project fields.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

OWNER="$(jq -r '.project.owner' "$MANIFEST")"
REPO="$(jq -r '.project.repo' "$MANIFEST")"
PROJECT_NUM="$(jq -r '.project.number' "$MANIFEST")"
REPO_SLUG="$OWNER/$REPO"

ledger_init
gh_require_project_scope

errors=0
warn=0

fail() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
}

warn_msg() {
  echo "WARN: $*" >&2
  warn=$((warn + 1))
}

echo "=== Ledger vs manifest ==="
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  program_id="$(echo "$row" | jq -r '.programId')"
  work_key="$(echo "$row" | jq -r '.workKey')"
  issue_num="$(echo "$row" | jq -r '.issue // empty')"
  key="${program_id}::${work_key}"
  ledger_issue="$(ledger_get "$key" issue)"

  if [[ -z "$ledger_issue" && -z "$issue_num" ]]; then
    fail "Missing issue for $key"
    continue
  fi

  num="${ledger_issue:-$issue_num}"
  if [[ -n "$issue_num" && -n "$ledger_issue" && "$issue_num" != "$ledger_issue" ]]; then
    fail "Issue mismatch for $key: manifest #$issue_num vs ledger #$ledger_issue"
  fi

  state="$(gh issue view "$num" --repo "$REPO_SLUG" --json state --jq .state 2>/dev/null || echo MISSING)"
  if [[ "$state" == "MISSING" ]]; then
    fail "Issue #$num not found for $key"
  fi

  manifest_status="$(echo "$row" | jq -r '.status')"
  if [[ "$manifest_status" == "done" && "$state" != "CLOSED" ]]; then
    warn_msg "$key (#$num) expected closed (archive) but state=$state"
  fi
done < <(manifest_all_items)

echo ""
echo "=== Project membership ==="
FIELDS="$(gh_retry read -- gh project field-list "$PROJECT_NUM" --owner "$OWNER" --format json)"
ITEMS="$(gh_retry read -- gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --limit 500)"

while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  program_id="$(echo "$row" | jq -r '.programId')"
  work_key="$(echo "$row" | jq -r '.workKey')"
  key="${program_id}::${work_key}"
  num="$(ledger_get "$key" issue)"
  [[ -z "$num" ]] && num="$(echo "$row" | jq -r '.issue // empty')"
  [[ -z "$num" ]] && continue

  iid="$(gh_retry read -- gh api graphql \
    -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){id}}}' \
    -f o="$OWNER" -f r="$REPO" -F n="$num" --jq '.data.repository.issue.id')"

  if ! echo "$ITEMS" | jq -e --arg id "$iid" '.items[] | select(.content.id==$id)' >/dev/null; then
    fail "Issue #$num ($key) not in project #$PROJECT_NUM"
  fi
done < <(manifest_all_items)

echo ""
echo "=== Cloud deploy #3–#14 ==="
for n in 3 4 5 6 7 8 9 10 11 12 13 14; do
  if ! gh issue view "$n" --repo "$REPO_SLUG" --json number --jq .number >/dev/null 2>&1; then
    fail "Cloud deploy issue #$n missing"
  fi
done

echo ""
if [[ "$errors" -gt 0 ]]; then
  echo "Verify FAILED: $errors error(s), $warn warning(s)"
  exit 1
fi
echo "Verify OK ($warn warning(s))"
exit 0
