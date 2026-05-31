#!/usr/bin/env bash
#
# ORY bootstrap for LINUX (apt/yum Postgres with a `postgres` OS user).
# Creates the Hydra/Kratos DB roles + databases and runs their migrations.
# On macOS use setup-ory-macos.sh instead.
#
# Usage (from anywhere):
#   HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./setup/setup-ory-linux.sh
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
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' not found." >&2; exit 1; }; }
require_cmd psql; require_cmd docker; require_cmd sudo

# Superuser psql via the postgres OS account (Linux default).
psql_super() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres "$@"; }

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
