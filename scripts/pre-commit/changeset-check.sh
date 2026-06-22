#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
# shellcheck source=scripts/pre-commit/lib.sh
source "$ROOT/scripts/pre-commit/lib.sh"

BASE_BRANCH="${CHANGESET_BASE_BRANCH:-feature/adventure-llm}"
BASE_REF="origin/$BASE_BRANCH"

require_command npm "Install Node.js 24+ (see .nvmrc)."
ensure_node_modules "$ROOT" "run: npm ci --ignore-scripts (repo root)"

cd "$ROOT"

if [[ "$(git branch --show-current)" == changeset-release/* ]]; then
  echo "Skipping changeset check on Version Packages branch."
  exit 0
fi

git fetch origin "$BASE_BRANCH" --quiet 2>/dev/null || true
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "warning: $BASE_REF not found — skipping changeset check (fetch origin first)." >&2
  exit 0
fi

npx changeset status --since="$BASE_REF"
