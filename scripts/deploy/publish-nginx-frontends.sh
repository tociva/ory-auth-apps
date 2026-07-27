#!/usr/bin/env bash
#
# Publish built Angular applications to the nginx document roots.
# Run `pnpm build` first. Override either root for a non-standard server layout.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AUTH_FRONTEND_DIST="$REPO_ROOT/monorepo/dist/apps/auth-frontend/browser"
ADMIN_FRONTEND_DIST="$REPO_ROOT/monorepo/dist/apps/admin-frontend/browser"
AUTH_FRONTEND_ROOT="${AUTH_FRONTEND_ROOT:-/var/www/auth-frontend/browser}"
ADMIN_FRONTEND_ROOT="${ADMIN_FRONTEND_ROOT:-/var/www/admin-frontend}"
ADMIN_CONFIG_RENDERER="$REPO_ROOT/scripts/deploy/render-admin-frontend-config.mjs"
ADMIN_CONFIG_TEMPLATE="$ADMIN_FRONTEND_DIST/config/config.tpl.json"

ADMIN_FRONTEND_API_BASE_URL="${ADMIN_FRONTEND_API_BASE_URL:-/api}"
: "${ADMIN_FRONTEND_AUTH_LOGOUT_URL:?ADMIN_FRONTEND_AUTH_LOGOUT_URL is required}"
export ADMIN_FRONTEND_API_BASE_URL ADMIN_FRONTEND_AUTH_LOGOUT_URL

for required in install node rm rsync; do
  command -v "$required" >/dev/null 2>&1 || {
    echo "Required command not found: $required" >&2
    exit 1
  }
done

for dist in "$AUTH_FRONTEND_DIST" "$ADMIN_FRONTEND_DIST"; do
  [ -d "$dist" ] || {
    echo "Build output not found: $dist" >&2
    exit 1
  }
done

for required_file in "$ADMIN_CONFIG_RENDERER" "$ADMIN_CONFIG_TEMPLATE"; do
  [ -f "$required_file" ] || {
    echo "Required frontend configuration file not found: $required_file" >&2
    exit 1
  }
done

install -d -m 0755 "$AUTH_FRONTEND_ROOT" "$ADMIN_FRONTEND_ROOT"
rsync -a --delete "$AUTH_FRONTEND_DIST/" "$AUTH_FRONTEND_ROOT/"
rsync -a --delete "$ADMIN_FRONTEND_DIST/" "$ADMIN_FRONTEND_ROOT/"

node "$ADMIN_CONFIG_RENDERER" \
  "$ADMIN_FRONTEND_ROOT/config/config.tpl.json" \
  "$ADMIN_FRONTEND_ROOT/config/config.json"
rm -f "$ADMIN_FRONTEND_ROOT/config/config.tpl.json"

echo "Published auth frontend to $AUTH_FRONTEND_ROOT"
echo "Published admin frontend to $ADMIN_FRONTEND_ROOT"
