#!/usr/bin/env bash
set -eu

########################################
# CONFIGURATION (EDIT THESE IF NEEDED)
########################################

# Hydra DB settings
HYDRA_DB_USER="${HYDRA_DB_USER:-hydrau}"
HYDRA_DB_NAME="${HYDRA_DB_NAME:-hydra}"
HYDRA_DB_PASSWORD="${HYDRA_DB_PASSWORD:-<<HYDRA_DB_PASSWORD>>}"

# Kratos DB settings
KRATOS_DB_USER="${KRATOS_DB_USER:-kratosu}"
KRATOS_DB_NAME="${KRATOS_DB_NAME:-kratos}"
KRATOS_DB_PASSWORD="${KRATOS_DB_PASSWORD:-<<KRATOS_DB_PASSWORD>>}"

# Docker images
HYDRA_IMAGE="${HYDRA_IMAGE:-oryd/hydra:v2.3.0}"
KRATOS_IMAGE="${KRATOS_IMAGE:-oryd/kratos:v1.1}"

# Kratos config directory on host (must exist)
KRATOS_CONFIG_DIR="${KRATOS_CONFIG_DIR:-$PWD/kratos-config}"

########################################
# HELPER FUNCTIONS
########################################

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' command not found. Please install it and re-run this script." >&2
    exit 1
  fi
}

psql_super() {
  # Uses local UNIX socket auth as OS user 'postgres' (no password prompts)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres "$@"
}

########################################
# CHECK DEPENDENCIES
########################################

require_cmd psql
require_cmd docker
require_cmd sudo

########################################
# CREATE / UPDATE HYDRA DB USER & DATABASE
########################################

echo "==> Creating or updating Hydra user and database..."

# 1) Create or update role
psql_super <<SQL
DO
\$do\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = '${HYDRA_DB_USER}'
  ) THEN
    CREATE ROLE ${HYDRA_DB_USER} LOGIN PASSWORD '${HYDRA_DB_PASSWORD}';
  ELSE
    ALTER ROLE ${HYDRA_DB_USER} WITH LOGIN PASSWORD '${HYDRA_DB_PASSWORD}';
  END IF;
END
\$do\$;
SQL

# 2) Create database if it does not exist, then set owner/privileges
psql_super <<SQL
SELECT 'CREATE DATABASE ${HYDRA_DB_NAME} OWNER ${HYDRA_DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${HYDRA_DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE ${HYDRA_DB_NAME} TO ${HYDRA_DB_USER};
ALTER DATABASE ${HYDRA_DB_NAME} OWNER TO ${HYDRA_DB_USER};
SQL

########################################
# CREATE / UPDATE KRATOS DB USER & DATABASE
########################################

echo "==> Creating or updating Kratos user and database..."

# 1) Create or update role
psql_super <<SQL
DO
\$do\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = '${KRATOS_DB_USER}'
  ) THEN
    CREATE ROLE ${KRATOS_DB_USER} LOGIN PASSWORD '${KRATOS_DB_PASSWORD}';
  ELSE
    ALTER ROLE ${KRATOS_DB_USER} WITH LOGIN PASSWORD '${KRATOS_DB_PASSWORD}';
  END IF;
END
\$do\$;
SQL

# 2) Create database if it does not exist, then set owner/privileges
psql_super <<SQL
SELECT 'CREATE DATABASE ${KRATOS_DB_NAME} OWNER ${KRATOS_DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${KRATOS_DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE ${KRATOS_DB_NAME} TO ${KRATOS_DB_USER};
ALTER DATABASE ${KRATOS_DB_NAME} OWNER TO ${KRATOS_DB_USER};
SQL

########################################
# RUN HYDRA MIGRATIONS
########################################

echo "==> Running ORY Hydra migrations..."

docker run --rm \
  --network host \
  -e "DSN=postgres://${HYDRA_DB_USER}:${HYDRA_DB_PASSWORD}@127.0.0.1:5432/${HYDRA_DB_NAME}?sslmode=disable" \
  "${HYDRA_IMAGE}" \
  migrate sql -e --yes

########################################
# RUN KRATOS MIGRATIONS
########################################

echo "==> Running ORY Kratos migrations..."

if [ ! -d "${KRATOS_CONFIG_DIR}" ]; then
  echo "Error: KRATOS_CONFIG_DIR='${KRATOS_CONFIG_DIR}' does not exist. Create it and put your Kratos config files there." >&2
  exit 1
fi

docker run --rm \
  --network host \
  -e "DSN=postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@127.0.0.1:5432/${KRATOS_DB_NAME}?sslmode=disable" \
  -v "${KRATOS_CONFIG_DIR}:/etc/config" \
  "${KRATOS_IMAGE}" \
  migrate sql -e --yes

echo "==> ORY Hydra & Kratos initial setup completed successfully."
