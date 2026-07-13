#!/usr/bin/env bash
#
# ORY bootstrap for Linux (apt/yum Postgres with a `postgres` OS user).
# Creates Hydra/Kratos roles, databases, dedicated schemas and runs ORY migrations.
# Optionally creates the authz role/database/schema when AUTHZ_DB_PASSWORD is set.
#
# Usage:
#   HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./scripts/setup/setup-ory-linux.sh
#
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

HYDRA_DB_USER="${HYDRA_DB_USER:-hydrau}"
HYDRA_DB_NAME="${HYDRA_DB_NAME:-hydra}"
HYDRA_DB_SCHEMA="${HYDRA_DB_SCHEMA:-hydra}"
HYDRA_DB_PASSWORD="${HYDRA_DB_PASSWORD:?set HYDRA_DB_PASSWORD}"

KRATOS_DB_USER="${KRATOS_DB_USER:-kratosu}"
KRATOS_DB_NAME="${KRATOS_DB_NAME:-kratos}"
KRATOS_DB_SCHEMA="${KRATOS_DB_SCHEMA:-kratos}"
KRATOS_DB_PASSWORD="${KRATOS_DB_PASSWORD:?set KRATOS_DB_PASSWORD}"

AUTHZ_DB_USER="${AUTHZ_DB_USER:-authzu}"
AUTHZ_DB_NAME="${AUTHZ_DB_NAME:-authz}"
AUTHZ_DB_SCHEMA="${AUTHZ_DB_SCHEMA:-authz}"

HYDRA_IMAGE="${HYDRA_IMAGE:-oryd/hydra:v26.2.0}"
KRATOS_IMAGE="${KRATOS_IMAGE:-oryd/kratos:v25.4.0}"
KRATOS_CONFIG_DIR="${KRATOS_CONFIG_DIR:-$REPO_ROOT/config}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' not found." >&2; exit 1; }; }
require_cmd psql
require_cmd docker
require_cmd sudo

psql_super() { sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }

ensure_role_db_schema() {
  local user="$1" pass="$2" db="$3" schema="$4"
  echo "==> Ensuring role '$user', database '$db' and schema '$schema'..."

  psql_super -d postgres -v role="$user" -v pass="$pass" -v db="$db" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role')\gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'role', :'pass')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db')\gexec
SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'db', :'role')\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'role')\gexec
SQL

  psql_super -d "$db" -v role="$user" -v schema="$schema" <<'SQL'
SELECT format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', :'schema', :'role')\gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA %I TO %I', :'schema', :'role')\gexec
SELECT format('ALTER ROLE %I IN DATABASE %I SET search_path = %I, public', :'role', current_database(), :'schema')\gexec
SQL
}

ensure_role_db_schema "$HYDRA_DB_USER" "$HYDRA_DB_PASSWORD" "$HYDRA_DB_NAME" "$HYDRA_DB_SCHEMA"
ensure_role_db_schema "$KRATOS_DB_USER" "$KRATOS_DB_PASSWORD" "$KRATOS_DB_NAME" "$KRATOS_DB_SCHEMA"

if [ -n "${AUTHZ_DB_PASSWORD:-}" ]; then
  ensure_role_db_schema "$AUTHZ_DB_USER" "$AUTHZ_DB_PASSWORD" "$AUTHZ_DB_NAME" "$AUTHZ_DB_SCHEMA"
else
  echo "==> AUTHZ_DB_PASSWORD not set; skipping authz role/database/schema creation."
fi

echo "==> Running Hydra migrations..."
docker run --rm --network host \
  -e "DSN=postgres://${HYDRA_DB_USER}:${HYDRA_DB_PASSWORD}@${PG_HOST}:${PG_PORT}/${HYDRA_DB_NAME}?sslmode=disable" \
  "$HYDRA_IMAGE" migrate sql up -e --yes

echo "==> Running Kratos migrations..."
[ -d "$KRATOS_CONFIG_DIR" ] || { echo "Error: KRATOS_CONFIG_DIR='$KRATOS_CONFIG_DIR' not found." >&2; exit 1; }
docker run --rm --network host \
  -e "DSN=postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${PG_HOST}:${PG_PORT}/${KRATOS_DB_NAME}?sslmode=disable" \
  -v "${KRATOS_CONFIG_DIR}:/etc/config" \
  "$KRATOS_IMAGE" migrate sql -e --yes

echo "==> ORY Hydra & Kratos setup complete."
