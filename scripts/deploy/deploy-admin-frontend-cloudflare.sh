#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MONOREPO_DIR="$REPO_ROOT/monorepo"
DIST_DIR="$MONOREPO_DIR/dist/apps/admin-frontend/browser"

PROJECT_NAME="${CF_PAGES_PROJECT_NAME:-${CF_PROJECT_NAME:-}}"
BRANCH_NAME="${CF_PAGES_BRANCH:-$(git -C "$REPO_ROOT" branch --show-current)}"
BRANCH_NAME="${BRANCH_NAME:-local}"

: "${PROJECT_NAME:?Set CF_PROJECT_NAME or CF_PAGES_PROJECT_NAME}"

cd "$MONOREPO_DIR"
pnpm admin-frontend:build

if [ ! -d "$DIST_DIR" ]; then
  echo "Build output not found: $DIST_DIR" >&2
  exit 1
fi

pnpm dlx wrangler pages deploy "$DIST_DIR" \
  --project-name "$PROJECT_NAME" \
  --branch "$BRANCH_NAME"
