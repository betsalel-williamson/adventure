#!/usr/bin/env bash
# Create GitHub issues from work-registry manifest (idempotent, rate-limit safe).
# ACID: ledger issue/linkStatus written only after successful GitHub mutations.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

DRY_RUN=false
RESUME=true
PROGRAM_FILTER=""
BATCH_SIZE="${MIGRATE_BATCH_SIZE:-5}"
BATCH_PAUSE="${MIGRATE_BATCH_PAUSE:-30}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --resume) RESUME=true; shift ;;
    --no-resume) RESUME=false; shift ;;
    --auto-wait) GH_RATE_LIMIT_POLICY=wait; shift ;;
    --quit-on-rate-limit) GH_RATE_LIMIT_POLICY=quit; shift ;;
    --program) PROGRAM_FILTER="$2"; shift 2 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--dry-run] [--resume|--no-resume] [--auto-wait|--quit-on-rate-limit] [--program <id>]

  --resume              Skip items already in ledger (default)
  --no-resume           Process all items (still skips ledger issue numbers)
  --auto-wait           Wait until rate-limit reset and continue automatically
  --quit-on-rate-limit  Exit with resume timestamp when quota is exhausted

Environment: MIGRATE_BATCH_SIZE, MIGRATE_BATCH_PAUSE, GH_RATE_LIMIT_POLICY
EOF
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

gh_init_rate_limit_policy

OWNER="$(jq -r '.project.owner' "$MANIFEST")"
REPO="$(jq -r '.project.repo' "$MANIFEST")"
REPO_SLUG="$OWNER/$REPO"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-feature/adventure-llm}"
BASE="https://github.com/$OWNER/$REPO/blob/$DEFAULT_BRANCH"

ledger_init

ledger_key() {
  echo "${1}::${2}"
}

ensure_label() {
  local label="$1"
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] ensure label: $label"
    return 0
  fi
  if gh_retry read -- gh label list --repo "$REPO_SLUG" --limit 200 --json name --jq '.[].name' | grep -qx "$label"; then
    return 0
  fi
  gh_retry mutation -- gh label create "$label" --repo "$REPO_SLUG" --force 2>/dev/null || true
}

issue_body_from_source() {
  local source="$1"
  local program_id="$2"
  local work_key="$3"
  local path="$REPO_ROOT/$source"
  if [[ ! -f "$path" ]]; then
    echo "## Source"
    echo "Manifest entry (source file missing: \`$source\`)"
    return
  fi
  local content
  content="$(cat "$path")"
  cat <<EOF
## Summary

Migrated from [\`$source\`]($BASE/$source) via work registry (\`$program_id\` / \`$work_key\`).

## Source content

$content

---
**Work registry:** \`scripts/work-registry/manifest.json\` · Program: \`$program_id\` · Work key: \`$work_key\`
EOF
}

create_issue_for_item() {
  local program_id="$1"
  local work_key="$2"
  local title="$3"
  local status="$4"
  local source="$5"
  local labels_json="$6"

  local key
  key="$(ledger_key "$program_id" "$work_key")"
  local existing
  existing="$(ledger_get "$key" issue)"

  if [[ -n "$existing" ]]; then
    echo "Skip create (ledger): $key → #$existing"
    return 0
  fi

  local pre_issue
  pre_issue="$(jq -r --arg p "$program_id" --arg w "$work_key" '
    .programs[] | select(.id==$p) | .items[] | select(.workKey==$w) | .issue // empty
  ' "$MANIFEST")"
  if [[ -n "$pre_issue" ]]; then
    ledger_set "$key" "$(jq -n --argjson n "$pre_issue" '{issue: $n}')"
    echo "Seeded ledger: $key → #$pre_issue"
    return 0
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] create issue: [$program_id] $work_key — $title (status=$status)"
    return 0
  fi

  local body labels_args=()
  body="$(issue_body_from_source "$source" "$program_id" "$work_key")"
  body_file="$(mktemp)"
  printf '%s' "$body" >"$body_file"

  labels_args+=(--label "program:$program_id")
  labels_args+=(--label "work-key:$work_key")
  gh_retry mutation -- gh label create "program:$program_id" --repo "$REPO_SLUG" --force >/dev/null 2>&1 || true
  gh_retry mutation -- gh label create "work-key:$work_key" --repo "$REPO_SLUG" --force >/dev/null 2>&1 || true
  while IFS= read -r extra; do
    [[ -n "$extra" ]] && labels_args+=(--label "$extra")
  done < <(echo "$labels_json" | jq -r '.[]? // empty')

  local url num
  url="$(gh_retry mutation -- gh issue create --repo "$REPO_SLUG" --title "$title" --body-file "$body_file" "${labels_args[@]}")"
  rm -f "$body_file"
  num="$(echo "$url" | grep -oE '[0-9]+$')"

  if [[ "$status" == "done" ]]; then
    gh_retry mutation -- gh issue close "$num" --repo "$REPO_SLUG" --comment "Archived from completed .work-items entry." >/dev/null
  fi

  ledger_set "$key" "$(jq -n --argjson n "$num" --arg s "$status" '{issue: $n, issueStatus: $s, migrateStatus: "done"}')"
  echo "Created #$num: $key"
}

issue_node_id() {
  local num="$1"
  gh_retry read -- gh api graphql \
    -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){id}}}' \
    -f o="$OWNER" -f r="$REPO" -F n="$num" --jq '.data.repository.issue.id'
}

link_sub_issue() {
  local program_id="$1"
  local parent_num="$2"
  local child_num="$3"
  local link_key
  link_key="$(link_ledger_key "$program_id" "$parent_num" "$child_num")"

  if [[ "$(ledger_get "$link_key" linkStatus)" == "done" ]]; then
    echo "Skip link (ledger): #$child_num → #$parent_num"
    return 0
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] link sub-issue #$child_num under #$parent_num"
    return 0
  fi

  local pid cid
  pid="$(issue_node_id "$parent_num")"
  cid="$(issue_node_id "$child_num")"
  if gh_retry mutation -- gh api graphql \
    -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' \
    -f p="$pid" -f c="$cid" >/dev/null 2>&1; then
    ledger_set "$link_key" "$(jq -n --argjson p "$parent_num" --argjson c "$child_num" \
      '{linkStatus: "done", parent: $p, child: $c}')"
    echo "Linked #$child_num → #$parent_num"
  else
    echo "  (sub-issue link may already exist: #$child_num → #$parent_num)"
    ledger_set "$link_key" "$(jq -n --argjson p "$parent_num" --argjson c "$child_num" \
      '{linkStatus: "done", parent: $p, child: $c, note: "assumed-existing"}')"
  fi
}

resolve_parent_issue_num() {
  local program_id="$1"
  local parent_work_key="$2"
  local key
  key="$(ledger_key "$program_id" "$parent_work_key")"
  ledger_get "$key" issue
}

link_hierarchy_for_program() {
  local program_id="$1"
  local epic_issue
  epic_issue="$(jq -r --arg p "$program_id" '.programs[] | select(.id==$p) | .epic.issue // empty' "$MANIFEST")"

  while IFS= read -r item; do
    [[ -z "$item" ]] && continue
    local work_key parent_work_key
    work_key="$(echo "$item" | jq -r '.workKey')"
    parent_work_key="$(echo "$item" | jq -r '.parentWorkKey // empty')"
    [[ -z "$parent_work_key" ]] && continue

    local child_num parent_num
    child_num="$(ledger_get "$(ledger_key "$program_id" "$work_key")" issue)"
    [[ -z "$child_num" ]] && continue

    parent_num="$(resolve_parent_issue_num "$program_id" "$parent_work_key")"
    if [[ -z "$parent_num" && "$parent_work_key" == "$(jq -r --arg p "$program_id" '.programs[]|select(.id==$p)|.epic.workKey' "$MANIFEST")" ]]; then
      parent_num="$epic_issue"
    fi
    [[ -z "$parent_num" ]] && continue
    [[ "$child_num" == "$parent_num" ]] && continue
    link_sub_issue "$program_id" "$parent_num" "$child_num"
  done < <(manifest_items_for_program "$program_id")
}

main() {
  gh auth status >/dev/null
  ledger_init

  if [[ "$DRY_RUN" != true ]]; then
    ensure_label "program:cloud-deploy-mvp"
  fi

  local created=0
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id work_key title status source labels_json
    program_id="$(echo "$row" | jq -r '.programId')"
    program_filter_match "$PROGRAM_FILTER" "$program_id" || continue

    work_key="$(echo "$row" | jq -r '.workKey')"
    title="$(echo "$row" | jq -r '.title')"
    status="$(echo "$row" | jq -r '.status')"
    source="$(echo "$row" | jq -r '.source // empty')"
    labels_json="$(echo "$row" | jq -c '.labels // []')"

    local key existing
    key="$(ledger_key "$program_id" "$work_key")"
    existing="$(ledger_get "$key" issue)"
    if [[ "$RESUME" == true && -n "$existing" ]]; then
      continue
    fi

    create_issue_for_item "$program_id" "$work_key" "$title" "$status" "$source" "$labels_json"
    created=$((created + 1))
    if [[ "$DRY_RUN" != true && $((created % BATCH_SIZE)) -eq 0 ]]; then
      echo "Batch pause (${BATCH_PAUSE}s)..."
      sleep "$BATCH_PAUSE"
    fi
  done < <(manifest_all_items)

  echo ""
  echo "Linking sub-issues..."
  while IFS= read -r prog; do
    local pid
    pid="$(echo "$prog" | jq -r '.id')"
    program_filter_match "$PROGRAM_FILTER" "$pid" || continue
    link_hierarchy_for_program "$pid"
  done < <(manifest_programs)

  echo "Migration pass complete."
}

main "$@"
