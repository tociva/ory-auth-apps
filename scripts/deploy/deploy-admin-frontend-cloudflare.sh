#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MONOREPO_DIR="${REPO_ROOT}/monorepo"

DIST="${DIST:-dist/apps/admin-frontend/browser}"
CF_PAGES_PROJECT_NAME="${CF_PAGES_PROJECT_NAME:-${CF_PROJECT_NAME:-}}"
CF_PAGES_BRANCH="${CF_PAGES_BRANCH:-$(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo "local")}"

if [ -z "${CF_PAGES_PROJECT_NAME}" ]; then
  echo "Set CF_PROJECT_NAME or CF_PAGES_PROJECT_NAME."
  exit 1
fi

cd "${MONOREPO_DIR}"

pnpm nx reset
pnpm nx build admin-frontend --configuration production

if [ ! -d "${DIST}" ]; then
  echo "Build output not found: ${MONOREPO_DIR}/${DIST}"
  exit 1
fi

pnpm dlx wrangler pages deploy "${DIST}" \
  --project-name "${CF_PAGES_PROJECT_NAME}" \
  --branch "${CF_PAGES_BRANCH}"
