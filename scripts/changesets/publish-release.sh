#!/usr/bin/env bash
# Create git tag and GitHub Release after Changesets version merge (private monorepo — no npm publish).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(node -p "require('$ROOT/adventure-v2/package.json').version")"
TAG="v${VERSION}"
CHANGELOG="$ROOT/adventure-v2/CHANGELOG.md"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  if gh release view "$TAG" >/dev/null 2>&1; then
    echo "Tag and release $TAG already exist — skipping tag and release"
    exit 0
  fi
  echo "Tag $TAG exists but GitHub Release missing — creating release only"
else
  git tag -a "$TAG" -m "Release $TAG"
  git push origin "$TAG"
fi

NOTES_FILE="$(mktemp)"
trap 'rm -f "$NOTES_FILE"' EXIT

if [ -f "$CHANGELOG" ]; then
  awk -v ver="$VERSION" '
    $0 ~ "^## " ver "$" { found=1; next }
    found && /^## / { exit }
    found { print }
  ' "$CHANGELOG" >"$NOTES_FILE" || true
fi

if [ ! -s "$NOTES_FILE" ]; then
  printf 'Release %s (adventure-v2 + adventure-langgraph fixed group).\n' "$TAG" >"$NOTES_FILE"
fi

gh release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE"
echo "Published $TAG"
