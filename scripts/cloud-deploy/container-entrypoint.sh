#!/bin/sh
# Start adventure-v2 API (8787) and assist-server (8790) in one container.
set -e

cleanup() {
  if [ -n "${V2_PID:-}" ]; then kill "$V2_PID" 2>/dev/null || true; fi
  if [ -n "${AS_PID:-}" ]; then kill "$AS_PID" 2>/dev/null || true; fi
}
trap cleanup INT TERM

cd /app/adventure-v2
./node_modules/.bin/tsx apps/server/src/cli.ts &
V2_PID=$!

cd /app/adventure-langgraph
./node_modules/.bin/tsx packages/assist-server/src/server.ts &
AS_PID=$!

wait "$V2_PID" "$AS_PID"
