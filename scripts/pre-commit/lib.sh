#!/usr/bin/env bash
# Shared helpers for local pre-commit hooks.

set -euo pipefail

repo_root() {
  git rev-parse --show-toplevel
}

require_command() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required. $hint" >&2
    exit 1
  fi
}

ensure_node_modules() {
  local package_dir="$1"
  local install_hint="$2"
  if [[ ! -d "$package_dir/node_modules" ]]; then
    echo "Missing $package_dir/node_modules — $install_hint" >&2
    exit 1
  fi
}
