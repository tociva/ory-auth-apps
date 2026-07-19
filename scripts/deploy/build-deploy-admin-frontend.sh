#!/usr/bin/env bash
set -euo pipefail

DIST="${DIST:-monorepo/dist/apps/admin-frontend/browser}"
CF_PAGES_PROJECT_NAME="${CF_PAGES_PROJECT_NAME:-${CF_PROJECT_NAME:-}}"
CF_PAGES_BRANCH="${CF_PAGES_BRANCH:-$(git branch --show-current 2>/dev/null || echo "local")}"
if [ -z "${CF_PAGES_PROJECT_NAME}" ]; then
  echo "Set CF_PROJECT_NAME or CF_PAGES_PROJECT_NAME."
  exit 1
fi

pnpm run build --configuration production

pnpm dlx wrangler pages deploy "${DIST}" \
  --project-name "${CF_PAGES_PROJECT_NAME}" \
  --branch "${CF_PAGES_BRANCH}"

echo "Deploy finished at $(date '+%Y-%m-%d %H:%M:%S %Z')"
