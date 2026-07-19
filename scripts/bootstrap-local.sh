#!/usr/bin/env bash
#
# Local one-shot bootstrap for Idnest auth development.
# Creates local Postgres roles/databases/schemas, runs migrations, starts ORY
# containers, and provisions the Idnest Admin console's infrastructure client.
#
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_DIR="$REPO_ROOT/monorepo"
COMPOSE_FILE="$REPO_ROOT/scripts/docker/docker-compose.yml"
ENV_HELPER="$REPO_ROOT/scripts/setup/load-project-env.sh"
ADMIN_CLIENT_PROVISIONER="$REPO_ROOT/scripts/setup/provision-admin-client.js"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' not found." >&2
    exit 1
  }
}

wait_for_url() {
  local label="$1" url="$2" tries="${3:-60}"
  echo "==> Waiting for $label..."
  for _ in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "==> $label is ready."
      return 0
    fi
    sleep 2
  done
  echo "Error: $label did not become ready at $url." >&2
  return 1
}

require_cmd node
require_cmd docker
require_cmd curl
require_cmd pnpm

# shellcheck source=scripts/setup/load-project-env.sh
. "$ENV_HELPER"
load_project_env "$REPO_ROOT"

case "$(uname -s)" in
  Darwin) SETUP_SCRIPT="$REPO_ROOT/scripts/setup/setup-ory-macos.sh" ;;
  Linux) SETUP_SCRIPT="$REPO_ROOT/scripts/setup/setup-ory-linux.sh" ;;
  *) echo "Error: unsupported OS '$(uname -s)'." >&2; exit 1 ;;
esac

"$SETUP_SCRIPT"

echo "==> Running authz migrations..."
(cd "$MONOREPO_DIR" && pnpm authz:migrate)

echo "==> Starting Hydra and Kratos containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

wait_for_url "Hydra" "http://localhost:4445/health/ready"
wait_for_url "Kratos" "http://localhost:4433/health/ready"

if [ -z "${ADMIN_OIDC_CLIENT_SECRET:-}" ]; then
  echo "Error: ADMIN_OIDC_CLIENT_SECRET is required for the confidential admin client." >&2
  exit 1
fi

echo "==> Provisioning the Idnest Admin infrastructure client..."
node "$ADMIN_CLIENT_PROVISIONER"

echo "==> Local auth bootstrap complete."
