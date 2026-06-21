#!/usr/bin/env bash
# Sync manifest + ledger issues to GitHub Project (Adventure) with rate-limit safety.
# Query-first: seeds ledger from live project, updates field options, then syncs gaps only.
# ACID: ledger syncStatus=done only after all mutations for an item succeed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=project-state.sh
source "$SCRIPT_DIR/project-state.sh"

DRY_RUN=false
RESUME=true
SEED_LEDGER=true
PROGRAM_FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --resume) RESUME=true; shift ;;
    --no-resume) RESUME=false; shift ;;
    --no-seed) SEED_LEDGER=false; shift ;;
    --auto-wait) GH_RATE_LIMIT_POLICY=wait; shift ;;
    --quit-on-rate-limit) GH_RATE_LIMIT_POLICY=quit; shift ;;
    --program) PROGRAM_FILTER="$2"; shift 2 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--dry-run] [--resume|--no-resume] [--no-seed] [--auto-wait|--quit-on-rate-limit] [--program <id>]

  --resume              Skip items with ledger syncStatus=done (default)
  --no-resume           Re-sync all items (still idempotent)
  --no-seed             Skip seeding ledger projectItemId from live project
  --auto-wait           Wait until rate-limit reset and continue automatically
  --quit-on-rate-limit  Exit with resume timestamp when quota is exhausted

Audit first: ./scripts/work-registry/audit-project.sh
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

gh_print_quota_status

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

ensure_project_fields() {
  load_fields_cache

  local -a programs phases work_keys
  mapfile -t programs < <(collect_programs)
  mapfile -t phases < <(collect_phases)
  mapfile -t work_keys < <(collect_work_keys)

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] ensure fields Program, Work key, Phase"
  else
    add_field_if_missing "Program" "SINGLE_SELECT" --single-select-options "$(IFS=,; echo "${programs[*]}")"
    add_field_if_missing "Work key" "SINGLE_SELECT" --single-select-options "$(IFS=,; echo "${work_keys[*]}")"
    add_field_if_missing "Phase" "SINGLE_SELECT" --single-select-options "$(IFS=,; echo "${phases[*]}")"
    load_fields_cache
  fi

  # Native GitHub Status field already exists — do not create a duplicate.
  update_single_select_options "Program" "$DRY_RUN" "${programs[@]}"
  update_single_select_options "Work key" "$DRY_RUN" "${work_keys[@]}"
  update_single_select_options "Phase" "$DRY_RUN" "${phases[@]}"

  if [[ "$DRY_RUN" != true ]]; then
    synced_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    ledger_meta_set "projectSetup" "$(jq -n --arg at "$synced_at" '{status: "done", completedAt: $at}')"
  fi
}

# Returns 0 when all field edits succeed.
sync_item_fields() {
  local project_id="$1"
  local item_id="$2"
  local program="$3"
  local work_key="$4"
  local phase="$5"
  local project_status="$6"

  local prog_field wk_field ph_field st_field
  prog_field="$(field_id "Program")"
  wk_field="$(field_id "Work key")"
  ph_field="$(field_id "Phase")"
  st_field="$(field_id "Status")"

  local prog_opt wk_opt ph_opt st_opt board_status
  prog_opt="$(field_option_id "Program" "$program")"
  wk_opt="$(field_option_id "Work key" "$work_key")"
  ph_opt="$(field_option_id "Phase" "$phase")"
  board_status="$(map_board_status "$project_status")"
  st_opt="$(field_option_id "Status" "$board_status")"

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] set fields #$item_id program=$program workKey=$work_key phase=$phase status=$board_status"
    return 0
  fi

  local failed=0
  if [[ -z "$prog_opt" ]]; then echo "WARN: missing Program option: $program" >&2; failed=1; fi
  if [[ -z "$wk_opt" ]]; then echo "WARN: missing Work key option: $work_key" >&2; failed=1; fi
  if [[ -z "$ph_opt" ]]; then echo "WARN: missing Phase option: $phase" >&2; failed=1; fi
  [[ "$failed" -eq 1 ]] && return 1

  gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
    --field-id "$prog_field" --single-select-option-id "$prog_opt" >/dev/null || failed=1
  gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
    --field-id "$wk_field" --single-select-option-id "$wk_opt" >/dev/null || failed=1
  gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
    --field-id "$ph_field" --single-select-option-id "$ph_opt" >/dev/null || failed=1
  if [[ -n "$st_opt" && -n "$st_field" ]]; then
    gh_retry mutation -- gh project item-edit --project-id "$project_id" --id "$item_id" \
      --field-id "$st_field" --single-select-option-id "$st_opt" >/dev/null || failed=1
  fi
  return "$failed"
}

main() {
  ensure_project
  load_project_id
  load_items_cache

  echo "=== Query live project ==="
  audit_project_gaps || true

  if [[ "$SEED_LEDGER" == true ]]; then
    echo ""
    echo "=== Seed ledger from board ==="
    seed_ledger_membership "$DRY_RUN"
    load_items_cache
  fi

  echo ""
  echo "=== Ensure project fields + options ==="
  ensure_project_fields

  local project_id="$PROJECT_ID"
  load_items_cache

  local numbers=()
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id issue_num
    program_id="$(echo "$row" | jq -r '.programId')"
    program_filter_match "$PROGRAM_FILTER" "$program_id" || continue
    issue_num="$(ledger_get "${program_id}::$(echo "$row" | jq -r '.workKey')" issue)"
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

  echo ""
  echo "=== Sync items ==="
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
    if [[ "$RESUME" == true && "$(ledger_get "$key" syncStatus)" == "done" ]]; then
      continue
    fi

    local item_id
    item_id="$(project_item_id_for_issue_num "$issue_num")"
    if [[ -z "$item_id" ]]; then
      if [[ "$DRY_RUN" == true ]]; then
        echo "[dry-run] add issue #$issue_num to project"
      else
        gh_retry mutation -- gh project item-add "$PROJECT_NUM" --owner "$OWNER" \
          --url "https://github.com/$OWNER/$REPO/issues/$issue_num" >/dev/null
        load_items_cache
        item_id="$(project_item_id_for_issue_num "$issue_num")"
        echo "Added #$issue_num to project"
      fi
    else
      echo "On board: #$issue_num ($key)"
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
        '{issue: $n, projectItemId: $pi, syncStatus: $ss, syncedAt: $at, membershipStatus: "on_board"}')"
    fi
    echo "Synced #$issue_num ($program_label / $work_key)"
  done < <(manifest_all_items)

  echo ""
  echo "Project: https://github.com/users/$OWNER/projects/$PROJECT_NUM"
}

main "$@"
