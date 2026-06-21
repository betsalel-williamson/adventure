#!/usr/bin/env bash
# Query GitHub Project state and compare to manifest (read-only helpers).
# Source from audit-project.sh and sync-github-project.sh.
set -euo pipefail

# Requires lib.sh (MANIFEST, OWNER, PROJECT_NUM, gh_retry, ledger_*)

FIELDS_CACHE=""
ITEMS_CACHE=""
PROJECT_ID=""

load_fields_cache() {
  FIELDS_CACHE="$(gh_retry read -- gh project field-list "$PROJECT_NUM" --owner "$OWNER" --format json)"
}

load_items_cache() {
  ITEMS_CACHE="$(gh_retry read -- gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --limit 500)"
}

load_project_id() {
  PROJECT_ID="$(gh_retry read -- gh project view "$PROJECT_NUM" --owner "$OWNER" --format json | jq -r .id)"
}

field_id() {
  local name="$1"
  echo "$FIELDS_CACHE" | jq -r --arg n "$name" '.fields[] | select(.name==$n) | .id'
}

field_option_names() {
  local field_name="$1"
  echo "$FIELDS_CACHE" | jq -r --arg fn "$field_name" '.fields[] | select(.name==$fn) | .options[]?.name'
}

field_option_id() {
  local field_name="$1"
  local option_name="$2"
  echo "$FIELDS_CACHE" | jq -r --arg fn "$field_name" --arg on "$option_name" \
    '.fields[] | select(.name==$fn) | .options[]? | select(.name==$on) | .id'
}

# gh project item-list exposes content.number, not content.id — match by issue number.
project_item_id_for_issue_num() {
  local num="$1"
  echo "$ITEMS_CACHE" | jq -r --argjson n "$num" '.items[] | select(.content.number == $n) | .id'
}

project_issue_numbers() {
  echo "$ITEMS_CACHE" | jq -r '.items[] | select(.content.type == "Issue") | .content.number'
}

collect_work_keys() {
  jq -r '.programs[].items[]?.workKey' "$MANIFEST" | sort -u
}

collect_phases() {
  jq -r '.fields.phase[]' "$MANIFEST"
}

collect_programs() {
  jq -r '.fields.program[]' "$MANIFEST"
}

map_board_status() {
  local status="$1"
  case "$status" in
    Todo) echo "Todo" ;;
    "In progress") echo "In Progress" ;;
    Done) echo "Done" ;;
    Blocked) echo "Todo" ;;
    *) echo "Todo" ;;
  esac
}

# Return option names missing from a single-select field (one per line).
missing_field_options() {
  local field_name="$1"
  shift
  local expected existing missing
  expected="$(printf '%s\n' "$@" | sort -u)"
  existing="$(field_option_names "$field_name" | sort -u)"
  missing="$(comm -23 <(echo "$expected") <(echo "$existing"))"
  echo "$missing"
}

# Build full single-select option payload (preserves existing option ids).
merged_select_options_json() {
  local field_name="$1"
  shift
  local required_json
  required_json="$(printf '%s\n' "$@" | sort -u | jq -R . | jq -s '.')"
  echo "$FIELDS_CACHE" | jq --arg fn "$field_name" --argjson required "$required_json" '
    (.fields[] | select(.name == $fn) | .options // []) as $existing |
    ($required | unique) as $names |
    [
      $names[] as $n |
      ($existing | map(select(.name == $n)) | .[0]) as $ex |
      if $ex then
        {id: $ex.id, name: $n, color: "GRAY", description: ""}
      else
        {name: $n, color: "GRAY", description: ""}
      end
    ]
  '
}

# Merge manifest options into an existing single-select field via GraphQL.
# Usage: update_single_select_options <FieldName> <dry_run true|false> <option>...
update_single_select_options() {
  local field_name="$1"
  local dry_run="$2"
  shift 2

  local field_id merged_json missing_count input_file query
  field_id="$(field_id "$field_name")"
  [[ -z "$field_id" || "$field_id" == "null" ]] && return 1

  local -a new_options=("$@")

  missing_count="$(missing_field_options "$field_name" "${new_options[@]}" | grep -c . || true)"
  if [[ "$missing_count" -eq 0 ]]; then
    echo "Field options complete: $field_name"
    return 0
  fi

  if [[ "$dry_run" == true ]]; then
    echo "[dry-run] update $field_name options (+$missing_count new)"
    missing_field_options "$field_name" "${new_options[@]}" | head -5 | sed 's/^/  /'
    return 0
  fi

  merged_json="$(merged_select_options_json "$field_name" "${new_options[@]}")"

  query='mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  updateProjectV2Field(input: {fieldId: $fieldId, singleSelectOptions: $options}) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
      }
    }
  }
}'

  input_file="$(mktemp)"
  jq -n \
    --arg query "$query" \
    --arg fieldId "$field_id" \
    --argjson options "$merged_json" \
    '{query: $query, variables: {fieldId: $fieldId, options: $options}}' >"$input_file"
  gh_retry mutation -- gh api graphql --input "$input_file" >/dev/null
  rm -f "$input_file"
  echo "Updated $field_name options (+$missing_count new)"
  load_fields_cache
}

# Write projectItemId for issues already on the board (does not set syncStatus=done).
seed_ledger_membership() {
  local dry_run="${1:-false}"
  local seeded=0
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id work_key issue_num key item_id
    program_id="$(echo "$row" | jq -r '.programId')"
    work_key="$(echo "$row" | jq -r '.workKey')"
    key="${program_id}::${work_key}"
    issue_num="$(ledger_get "$key" issue)"
    [[ -z "$issue_num" ]] && issue_num="$(echo "$row" | jq -r '.issue // empty')"
    [[ -z "$issue_num" ]] && continue

    item_id="$(project_item_id_for_issue_num "$issue_num")"
    [[ -z "$item_id" ]] && continue

    if [[ "$(ledger_get "$key" projectItemId)" == "$item_id" ]]; then
      continue
    fi

    if [[ "$dry_run" == true ]]; then
      echo "[dry-run] seed membership: #$issue_num ($key) → $item_id"
    else
      ledger_set "$key" "$(jq -n \
        --argjson n "$issue_num" \
        --arg pi "$item_id" \
        --arg ms "on_board" \
        '{issue: $n, projectItemId: $pi, membershipStatus: $ms}')"
    fi
    seeded=$((seeded + 1))
  done < <(manifest_all_items)
  echo "Seeded ledger membership for $seeded item(s) already on the board."
}

issue_node_id() {
  local num="$1"
  gh_retry read -- gh api graphql \
    -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){id}}}' \
    -f o="$OWNER" -f r="$REPO" -F n="$num" --jq '.data.repository.issue.id'
}

batch_issue_node_ids() {
  local numbers=("$@")
  local query='query($o:String!,$r:String!){repository(owner:$o,name:$r){'
  for n in "${numbers[@]}"; do
    query+="i${n}:issue(number:${n}){id number}"
  done
  query+='}}'
  gh_retry read -- gh api graphql -f query="$query" -f o="$OWNER" -f r="$REPO"
}

issue_node_id_from_cache() {
  local num="$1"
  local json="$2"
  echo "$json" | jq -r --argjson n "$num" '.data.repository["i\($n)"].id // empty'
}

# Emit audit summary to stdout; returns 0 if nothing to do.
audit_project_gaps() {
  local expected_on_board=0 on_board=0 missing_board=0 synced=0 need_fields=0

  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local program_id work_key issue_num key
    program_id="$(echo "$row" | jq -r '.programId')"
    work_key="$(echo "$row" | jq -r '.workKey')"
    key="${program_id}::${work_key}"
    issue_num="$(ledger_get "$key" issue)"
    [[ -z "$issue_num" ]] && issue_num="$(echo "$row" | jq -r '.issue // empty')"
    [[ -z "$issue_num" ]] && continue
    expected_on_board=$((expected_on_board + 1))

    if [[ -n "$(project_item_id_for_issue_num "$issue_num")" ]]; then
      on_board=$((on_board + 1))
    else
      missing_board=$((missing_board + 1))
      echo "MISSING_BOARD: #$issue_num $key"
    fi

    if [[ "$(ledger_get "$key" syncStatus)" == "done" ]]; then
      synced=$((synced + 1))
    else
      need_fields=$((need_fields + 1))
    fi
  done < <(manifest_all_items)

  local wk_missing ph_missing prog_missing
  local -a _wk _ph _prog
  while IFS= read -r line; do [[ -n "$line" ]] && _wk+=("$line"); done < <(collect_work_keys)
  while IFS= read -r line; do [[ -n "$line" ]] && _ph+=("$line"); done < <(collect_phases)
  while IFS= read -r line; do [[ -n "$line" ]] && _prog+=("$line"); done < <(collect_programs)
  wk_missing="$(missing_field_options "Work key" "${_wk[@]}" | sed '/^$/d' | wc -l | tr -d ' ')"
  ph_missing="$(missing_field_options "Phase" "${_ph[@]}" | sed '/^$/d' | wc -l | tr -d ' ')"
  prog_missing="$(missing_field_options "Program" "${_prog[@]}" | sed '/^$/d' | wc -l | tr -d ' ')"

  echo "SUMMARY: expected=$expected_on_board on_board=$on_board missing_board=$missing_board synced=$synced need_field_sync=$need_fields"
  echo "FIELD_GAPS: work_key_options_missing=$wk_missing phase_options_missing=$ph_missing program_options_missing=$prog_missing"
}
