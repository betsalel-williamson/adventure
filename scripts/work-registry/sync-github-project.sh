#!/usr/bin/env bash
# Sync manifest + ledger issues to GitHub Project (Adventure) with rate-limit safety.
# ACID: ledger syncStatus=done only after all mutations for an item succeed.
# Resume is default; re-run the same command to continue without redoing completed items.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

DRY_RUN=false
RESUME=true
PROGRAM_FILTER=""

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

  --resume              Skip items with ledger syncStatus=done (default)
  --no-resume           Re-sync all items (still idempotent; does not recreate issues)
  --auto-wait           Wait until rate-limit reset and continue automatically
  --quit-on-rate-limit  Exit with resume timestamp when quota is exhausted (non-interactive default)

Environment: GH_SYNC_DELAY_SEC, GH_SYNC_READ_DELAY_SEC, GH_GRAPHQL_FLOOR, GH_RATE_LIMIT_POLICY
EOF
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

gh_init_rate_limit_policy

OWNER="$(jq -r '.project.owner' "$MANIFEST")"
REPO="$(jq -r '.project.repo' "$MANIFEST")"
PROJECT_NUM="$(jq -r '.project.number' "$MANIFEST")"
PROJECT_TITLE="$(jq -r '.project.title' "$MANIFEST")"
REPO_SLUG="$OWNER/$REPO"

gh_require_project_scope
ledger_init

FIELDS_CACHE=""
ITEMS_CACHE=""

load_fields_cache() {
  FIELDS_CACHE="$(gh_retry read -- gh project field-list "$PROJECT_NUM" --owner "$OWNER" --format json)"
}

load_items_cache() {
  ITEMS_CACHE="$(gh_retry read -- gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --limit 500)"
}

field_id() {
  local name="$1"
  echo "$FIELDS_CACHE" | jq -r --arg n "$name" '.fields[] | select(.name==$n) | .id'
}

field_option_id() {
  local field_name="$1"
  local option_name="$2"
  echo "$FIELDS_CACHE" | jq -r --arg fn "$field_name" --arg on "$option_name" \
    '.fields[] | select(.name==$fn) | .options[]? | select(.name==$on) | .id'
}

ensure_project() {
  local current_title
  current_title="$(gh_retry read -- gh project view "$PROJECT_NUM" --owner "$OWNER" --format json | jq -r .title)"
  if [[ "$current_title" != "$PROJECT_TITLE" && "$DRY_RUN" != true ]]; then
    echo "Renaming project #$PROJECT_NUM: $current_title → $PROJECT_TITLE"
    gh_retry mutation -- gh project edit "$PROJECT_NUM" --owner "$OWNER" --title "$PROJECT_TITLE" >/dev/null
  fi
  gh_retry mutation -- gh project link "$PROJECT_NUM" --owner "$OWNER" --repo "$REPO_SLUG" 2>/dev/null || true
}

add_field_if_missing() {
  local name="$1"
  local type="$2"
  shift 2
  if echo "$FIELDS_CACHE" | jq -e --arg n "$name" '.fields[] | select(.name==$n)' >/dev/null; then
    echo "Field exists: $name"
    return 0
  fi
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] create field: $name"
    return 0
  fi
  gh_retry mutation -- gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "$name" --data-type "$type" "$@" --format json >/dev/null
  echo "Created field: $name"
  load_fields_cache
}

collect_work_keys() {
  jq -r '.programs[].items[]?.workKey' "$MANIFEST" | sort -u | paste -sd, -
}

collect_phases() {
  jq -r '.fields.phase[]' "$MANIFEST" | paste -sd, -
}

collect_programs() {
  jq -r '.fields.program[]' "$MANIFEST" | paste -sd, -
}

batch_issue_node_ids() {
  local numbers=("$@")
  local query='query($o:String!,$r:String!){repository(owner:$o,name:$r){'
  local idx=0
  for n in "${numbers[@]}"; do
    query+="i${n}:issue(number:${n}){id number}"
    idx=$((idx + 1))
  done
  query+='}}'
  gh_retry read -- gh api graphql -f query="$query" -f o="$OWNER" -f r="$REPO"
}

issue_node_id_from_cache() {
  local num="$1"
  local json="$2"
  echo "$json" | jq -r --argjson n "$num" '.data.repository["i\($n)"].id // empty'
}

project_item_id_for_issue() {
  local issue_node_id="$1"
  echo "$ITEMS_CACHE" | jq -r --arg id "$issue_node_id" '.items[] | select(.content.id==$id) | .id'
}

# Returns 0 when all field edits succeed; non-zero otherwise (ledger not updated by caller).
sync_item_fields() {
  local project_id="$1"
  local item_id="$2"
  local program="$3"
  local work_key="$4"
  local phase="$5"
  local status="$6"

  local prog_field wk_field ph_field st_field
  prog_field="$(field_id "Program")"
  wk_field="$(field_id "Work key")"
  ph_field="$(field_id "Phase")"
  st_field="$(field_id "Status")"

  local prog_opt wk_opt ph_opt st_opt
  prog_opt="$(field_option_id "Program" "$program")"
  wk_opt="$(field_option_id "Work key" "$work_key")"
  ph_opt="$(field_option_id "Phase" "$phase")"
  st_opt="$(field_option_id "Status" "$status")"

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] set fields item=$item_id program=$program workKey=$work_key phase=$phase status=$status"
    return 0
  fi

  local failed=0
  if [[ -n "$prog_opt" && -n "$prog_field" ]]; then
    gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
      --field-id "$prog_field" --single-select-option-id "$prog_opt" >/dev/null || failed=1
  fi
  if [[ -n "$wk_opt" && -n "$wk_field" ]]; then
    gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
      --field-id "$wk_field" --single-select-option-id "$wk_opt" >/dev/null || failed=1
  fi
  if [[ -n "$ph_opt" && -n "$ph_field" ]]; then
    gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
      --field-id "$ph_field" --single-select-option-id "$ph_opt" >/dev/null || failed=1
  fi
  if [[ -n "$st_opt" && -n "$st_field" ]]; then
    gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
      --field-id "$st_field" --single-select-option-id "$st_opt" >/dev/null || failed=1
  fi
  return "$failed"
}

ensure_project_fields() {
  if project_setup_done; then
    echo "Project field setup complete (ledger); loading field cache."
    load_fields_cache
    return 0
  fi

  load_fields_cache

  local work_keys programs phases
  work_keys="$(collect_work_keys)"
  programs="$(collect_programs)"
  phases="$(collect_phases)"

  add_field_if_missing "Program" "SINGLE_SELECT" --single-select-options "$programs"
  add_field_if_missing "Work key" "SINGLE_SELECT" --single-select-options "$work_keys"
  add_field_if_missing "Phase" "SINGLE_SELECT" --single-select-options "$phases"
  add_field_if_missing "Status" "SINGLE_SELECT" --single-select-options "Todo,In progress,Blocked,Done"

  load_fields_cache

  if [[ "$DRY_RUN" != true ]]; then
    synced_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    ledger_meta_set "projectSetup" "$(jq -n --arg at "$synced_at" '{status: "done", completedAt: $at}')"
    echo "Project field setup recorded in ledger."
  fi
}

main() {
  ensure_project

  if project_setup_done; then
    load_fields_cache
  else
    ensure_project_fields
  fi

  local project_id
  project_id="$(gh_retry read -- gh project view "$PROJECT_NUM" --owner "$OWNER" --format json | jq -r .id)"
  load_items_cache

  local numbers=()
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id issue_num
    program_id="$(echo "$row" | jq -r '.programId')"
    program_filter_match "$PROGRAM_FILTER" "$program_id" || continue
    local work_key
    work_key="$(echo "$row" | jq -r '.workKey')"
    issue_num="$(ledger_get "${program_id}::${work_key}" issue)"
    [[ -z "$issue_num" ]] && issue_num="$(echo "$row" | jq -r '.issue // empty')"
    [[ -n "$issue_num" ]] && numbers+=("$issue_num")
  done < <(manifest_all_items)

  local node_json=""
  if [[ ${#numbers[@]} -gt 0 ]]; then
    local chunk=()
    for n in "${numbers[@]}"; do
      chunk+=("$n")
      if [[ ${#chunk[@]} -ge 15 ]]; then
        local part
        part="$(batch_issue_node_ids "${chunk[@]}")"
        node_json="$(if [[ -z "$node_json" ]]; then echo "$part"; else jq -s '.[0].data.repository * .[1].data.repository | {data: {repository: .}}' <(echo "$node_json") <(echo "$part"); fi)"
        chunk=()
      fi
    done
    if [[ ${#chunk[@]} -gt 0 ]]; then
      local part
      part="$(batch_issue_node_ids "${chunk[@]}")"
      if [[ -z "$node_json" ]]; then
        node_json="$part"
      else
        node_json="$(jq -s '.[0].data.repository * .[1].data.repository | {data: {repository: .}}' <(echo "$node_json") <(echo "$part"))"
      fi
    fi
  fi

  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id program_label work_key phase project_status issue_num
    program_id="$(echo "$row" | jq -r '.programId')"
    program_filter_match "$PROGRAM_FILTER" "$program_id" || continue

    program_label="$(echo "$row" | jq -r '.programLabel')"
    work_key="$(echo "$row" | jq -r '.workKey')"
    phase="$(echo "$row" | jq -r '.phase // "Implementation"')"
    project_status="$(echo "$row" | jq -r '.projectStatus // "Todo"')"
    issue_num="$(ledger_get "${program_id}::${work_key}" issue)"
    [[ -z "$issue_num" ]] && issue_num="$(echo "$row" | jq -r '.issue // empty')"
    [[ -z "$issue_num" ]] && continue

    local key
    key="${program_id}::${work_key}"
    if [[ "$RESUME" == true ]]; then
      local synced
      synced="$(ledger_get "$key" syncStatus)"
      [[ "$synced" == "done" ]] && continue
    fi

    local iid item_id
    iid="$(issue_node_id_from_cache "$issue_num" "$node_json")"
    [[ -z "$iid" ]] && iid="$(issue_node_id "$issue_num")"

    item_id="$(project_item_id_for_issue "$iid")"
    if [[ -z "$item_id" ]]; then
      if [[ "$DRY_RUN" == true ]]; then
        echo "[dry-run] add issue #$issue_num to project"
      else
        gh_retry mutation -- gh project item-add "$PROJECT_NUM" --owner "$OWNER" \
          --url "https://github.com/$OWNER/$REPO/issues/$issue_num" >/dev/null
        load_items_cache
        item_id="$(project_item_id_for_issue "$iid")"
        echo "Added #$issue_num to project"
      fi
    fi

    [[ -z "$item_id" ]] && continue

    if ! sync_item_fields "$project_id" "$item_id" "$program_label" "$work_key" "$phase" "$project_status"; then
      echo "ERROR: field sync failed for #$issue_num ($key). Ledger not updated — re-run with --resume." >&2
      exit 1
    fi

    if [[ "$DRY_RUN" != true ]]; then
      synced_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      ledger_set "$key" "$(jq -n \
        --argjson n "$issue_num" \
        --arg pi "$item_id" \
        --arg ss "done" \
        --arg at "$synced_at" \
        '{issue: $n, projectItemId: $pi, syncStatus: $ss, syncedAt: $at}')"
    fi
    echo "Synced #$issue_num ($program_label / $work_key)"
  done < <(manifest_all_items)

  echo ""
  echo "Project: https://github.com/users/$OWNER/projects/$PROJECT_NUM"
}

issue_node_id() {
  gh_retry read -- gh api graphql \
    -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){id}}}' \
    -f o="$OWNER" -f r="$REPO" -F n="$1" --jq '.data.repository.issue.id'
}

main "$@"
