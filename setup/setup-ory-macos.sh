#!/usr/bin/env bash
#
# ORY bootstrap for macOS (Homebrew Postgres — the current user is the
# superuser; there is no `postgres` OS user, so no `sudo -u postgres`).
# Creates the Hydra/Kratos DB roles + databases and runs their migrations.
# On Linux use setup-ory-linux.sh instead.
#
# Usage (from anywhere):
#   HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./setup/setup-ory-macos.sh
#
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- config (override via env) ---------------------------------------------
HYDRA_DB_USER="${HYDRA_DB_USER:-hydrau}"
HYDRA_DB_NAME="${HYDRA_DB_NAME:-hydra}"
HYDRA_DB_PASSWORD="${HYDRA_DB_PASSWORD:?set HYDRA_DB_PASSWORD}"

KRATOS_DB_USER="${KRATOS_DB_USER:-kratosu}"
KRATOS_DB_NAME="${KRATOS_DB_NAME:-kratos}"
KRATOS_DB_PASSWORD="${KRATOS_DB_PASSWORD:?set KRATOS_DB_PASSWORD}"

HYDRA_IMAGE="${HYDRA_IMAGE:-oryd/hydra:v2.3.0}"
KRATOS_IMAGE="${KRATOS_IMAGE:-oryd/kratos:v1.3.1}"
KRATOS_CONFIG_DIR="${KRATOS_CONFIG_DIR:-$REPO_ROOT/config}"
# Database to connect to as the local superuser, and how Docker reaches the host.
PG_SUPERDB="${PG_SUPERDB:-postgres}"
DOCKER_PG_HOST="${DOCKER_PG_HOST:-host.docker.internal}"
PG_PORT="${PG_PORT:-5432}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' not found." >&2; exit 1; }; }
require_cmd psql; require_cmd docker

# Homebrew Postgres: connect as the current macOS user (a superuser). Override
# the connecting role with the standard PGUSER env var if needed.
psql_super() { psql -v ON_ERROR_STOP=1 -d "$PG_SUPERDB" "$@"; }

create_role_and_db() {
  local user="$1" pass="$2" db="$3"
  echo "==> Ensuring role '$user' and database '$db'..."
  psql_super <<SQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
    CREATE ROLE ${user} LOGIN PASSWORD '${pass}';
  ELSE
    ALTER ROLE ${user} WITH LOGIN PASSWORD '${pass}';
  END IF;
END
\$do\$;
SQL
  psql_super <<SQL
SELECT 'CREATE DATABASE ${db} OWNER ${user}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${user};
ALTER DATABASE ${db} OWNER TO ${user};
SQL
}

create_role_and_db "$HYDRA_DB_USER"  "$HYDRA_DB_PASSWORD"  "$HYDRA_DB_NAME"
create_role_and_db "$KRATOS_DB_USER" "$KRATOS_DB_PASSWORD" "$KRATOS_DB_NAME"

echo "==> Running Hydra migrations..."
docker run --rm \
  -e "DSN=postgres://${HYDRA_DB_USER}:${HYDRA_DB_PASSWORD}@${DOCKER_PG_HOST}:${PG_PORT}/${HYDRA_DB_NAME}?sslmode=disable" \
  "$HYDRA_IMAGE" migrate sql up -e --yes

echo "==> Running Kratos migrations..."
[ -d "$KRATOS_CONFIG_DIR" ] || { echo "Error: KRATOS_CONFIG_DIR='$KRATOS_CONFIG_DIR' not found." >&2; exit 1; }
docker run --rm \
  -e "DSN=postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${DOCKER_PG_HOST}:${PG_PORT}/${KRATOS_DB_NAME}?sslmode=disable" \
  -v "${KRATOS_CONFIG_DIR}:/etc/config" \
  "$KRATOS_IMAGE" migrate sql -e --yes

echo "==> ORY Hydra & Kratos setup complete."
echo "    If a migration can't connect, ensure Homebrew Postgres listens beyond"
echo "    localhost (listen_addresses + pg_hba allow the Docker subnet)."
