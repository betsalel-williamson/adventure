#!/usr/bin/env bash
# Backward-compatible wrapper — syncs cloud-deploy items via work registry.
set -euo pipefail
exec "$(dirname "$0")/work-registry/sync-github-project.sh" --program cloud-deploy-mvp "$@"
