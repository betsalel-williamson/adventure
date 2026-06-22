#!/usr/bin/env bash
# Emit docker build --build-arg flags for C1 image metadata.
# Usage: docker build $(./scripts/cloud-deploy/docker-build-args.sh [git-sha] [image-tag]) -t adventure-cloud .
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SHA="${1:-$(git -C "$ROOT" rev-parse HEAD)}"
TAG="${2:-$SHA}"
TIME="${3:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

printf '%s\n' \
  "--build-arg" "BUILD_GIT_SHA=${SHA}" \
  "--build-arg" "BUILD_IMAGE_TAG=${TAG}" \
  "--build-arg" "BUILD_TIME=${TIME}"
