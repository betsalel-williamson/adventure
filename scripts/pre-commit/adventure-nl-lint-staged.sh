#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
# shellcheck source=scripts/pre-commit/lib.sh
source "$ROOT/scripts/pre-commit/lib.sh"

require_command npm "Install Node.js 24+ (see .nvmrc)."
ensure_node_modules "$ROOT/adventure-nl" "run: npm ci --prefix adventure-nl"

cd "$ROOT/adventure-nl"
npx lint-staged
