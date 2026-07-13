#!/usr/bin/env bash
#
# Local one-shot bootstrap for Idnest auth development.
# Creates local Postgres roles/databases/schemas, runs migrations, starts ORY
# containers, and registers the Idnest admin Hydra client.
#
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_DIR="$REPO_ROOT/monorepo"
COMPOSE_FILE="$REPO_ROOT/scripts/docker/docker-compose.yml"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' not found." >&2
    exit 1
  }
}

load_env_file() {
  local file="$1"
  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file"
    set +a
  else
    echo "Error: expected env file '$file'." >&2
    echo "Copy the matching .env.example and fill in local values first." >&2
    exit 1
  fi
}

url_part() {
  local url="$1" part="$2"
  node -e '
const url = new URL(process.argv[1]);
const part = process.argv[2];
if (part === "username") process.stdout.write(decodeURIComponent(url.username));
if (part === "password") process.stdout.write(decodeURIComponent(url.password));
if (part === "hostname") process.stdout.write(url.hostname);
if (part === "port") process.stdout.write(url.port);
if (part === "database") process.stdout.write(url.pathname.replace(/^\/+/, ""));
' "$url" "$part"
}

derive_db_env() {
  HYDRA_DB_USER="${HYDRA_DB_USER:-$(url_part "$HYDRA_DSN" username)}"
  HYDRA_DB_PASSWORD="${HYDRA_DB_PASSWORD:-$(url_part "$HYDRA_DSN" password)}"
  HYDRA_DB_NAME="${HYDRA_DB_NAME:-$(url_part "$HYDRA_DSN" database)}"
  HYDRA_DB_SCHEMA="${HYDRA_DB_SCHEMA:-hydra}"

  KRATOS_DB_USER="${KRATOS_DB_USER:-$(url_part "$KRATOS_DSN" username)}"
  KRATOS_DB_PASSWORD="${KRATOS_DB_PASSWORD:-$(url_part "$KRATOS_DSN" password)}"
  KRATOS_DB_NAME="${KRATOS_DB_NAME:-$(url_part "$KRATOS_DSN" database)}"
  KRATOS_DB_SCHEMA="${KRATOS_DB_SCHEMA:-kratos}"

  if [ -n "${AUTHZ_DATABASE_URL:-}" ]; then
    AUTHZ_DB_USER="${AUTHZ_DB_USER:-$(url_part "$AUTHZ_DATABASE_URL" username)}"
    AUTHZ_DB_PASSWORD="${AUTHZ_DB_PASSWORD:-$(url_part "$AUTHZ_DATABASE_URL" password)}"
    AUTHZ_DB_NAME="${AUTHZ_DB_NAME:-$(url_part "$AUTHZ_DATABASE_URL" database)}"
  fi
  AUTHZ_DB_SCHEMA="${AUTHZ_DB_SCHEMA:-authz}"

  export HYDRA_DB_USER HYDRA_DB_PASSWORD HYDRA_DB_NAME HYDRA_DB_SCHEMA
  export KRATOS_DB_USER KRATOS_DB_PASSWORD KRATOS_DB_NAME KRATOS_DB_SCHEMA
  export AUTHZ_DB_USER AUTHZ_DB_PASSWORD AUTHZ_DB_NAME AUTHZ_DB_SCHEMA
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

load_env_file "$REPO_ROOT/.env"
load_env_file "$MONOREPO_DIR/.env"
derive_db_env

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

wait_for_url "Hydra" "http://localhost:4444/health/ready"
wait_for_url "Kratos" "http://localhost:4433/health/ready"

echo "==> Seeding bootstrap admin grants..."
(cd "$MONOREPO_DIR" && pnpm authz:seed)

if [ -z "${ADMIN_OIDC_CLIENT_SECRET:-}" ]; then
  echo "Error: ADMIN_OIDC_CLIENT_SECRET is required for the confidential admin client." >&2
  exit 1
fi

echo "==> Registering Idnest admin Hydra client..."
(cd "$MONOREPO_DIR" && pnpm hydra:admin-client)

echo "==> Local auth bootstrap complete."
