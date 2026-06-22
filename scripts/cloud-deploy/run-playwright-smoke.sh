#!/usr/bin/env bash
# Build langgraph shell pointed at remote APIs, serve preview, run Playwright CRT smoke.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${OCI_DEPLOY_HOST:?Set OCI_DEPLOY_HOST to the VM public IP}"
API_URL="${VITE_API_URL:-http://${HOST}:8787}"
ASSIST_URL="${VITE_ASSIST_URL:-http://${HOST}:8790}"
SHELL_PORT="${PLAYWRIGHT_SHELL_PORT:-5174}"

cd "$ROOT/adventure-langgraph"
if [ ! -d node_modules ]; then
  npm ci --ignore-scripts
fi

VITE_API_URL="$API_URL" VITE_ASSIST_URL="$ASSIST_URL" npm run build

VITE_API_URL="$API_URL" VITE_ASSIST_URL="$ASSIST_URL" \
  npx vite preview --port "$SHELL_PORT" --host 127.0.0.1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${SHELL_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd "$ROOT"
if [ ! -d node_modules/@playwright/test ]; then
  npm ci --ignore-scripts
fi
PLAYWRIGHT_SHELL_PORT="$SHELL_PORT" npx playwright test --config e2e/playwright.config.ts
