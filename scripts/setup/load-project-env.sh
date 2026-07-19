#!/usr/bin/env bash
# Shared environment loading and database derivation for local setup scripts.
# This file is sourced by bootstrap-local.sh and the OS-specific setup helpers.

load_env_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Error: expected env file '$file'." >&2
    echo "Copy the matching .env.example and fill in local values first." >&2
    return 1
  fi

  case "$-" in
    *a*)
      # allexport is already enabled by the caller.
      # shellcheck disable=SC1090
      . "$file"
      ;;
    *)
      set -a
      # shellcheck disable=SC1090
      . "$file"
      set +a
      ;;
  esac
}

load_project_env() {
  local repo_root="$1"

  # Infrastructure values come from the root file; application and Authz
  # values come from monorepo/.env. Setup deliberately reads both sources.
  load_env_file "$repo_root/.env"
  load_env_file "$repo_root/monorepo/.env"
}

database_url_part() {
  local url="$1" part="$2"

  node -e '
const url = new URL(process.argv[1]);
const part = process.argv[2];
if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
  throw new Error(`expected a postgres URL, received ${url.protocol}`);
}
if (part === "username") process.stdout.write(decodeURIComponent(url.username));
if (part === "password") process.stdout.write(decodeURIComponent(url.password));
if (part === "database") process.stdout.write(decodeURIComponent(url.pathname.replace(/^\/+/, "")));
' "$url" "$part"
}

require_database_part() {
  local database="$1" part="$2" value="$3"

  if [ -z "$value" ]; then
    echo "Error: $database database URL must include a $part." >&2
    return 1
  fi
}

derive_database_env() {
  : "${HYDRA_DSN:?HYDRA_DSN is required in the root .env}"
  : "${KRATOS_DSN:?KRATOS_DSN is required in the root .env}"
  : "${AUTHZ_DATABASE_URL:?AUTHZ_DATABASE_URL is required in monorepo/.env}"

  HYDRA_DB_USER="$(database_url_part "$HYDRA_DSN" username)"
  HYDRA_DB_PASSWORD="$(database_url_part "$HYDRA_DSN" password)"
  HYDRA_DB_NAME="$(database_url_part "$HYDRA_DSN" database)"
  HYDRA_DB_SCHEMA="${HYDRA_DB_SCHEMA:-$HYDRA_DB_NAME}"

  KRATOS_DB_USER="$(database_url_part "$KRATOS_DSN" username)"
  KRATOS_DB_PASSWORD="$(database_url_part "$KRATOS_DSN" password)"
  KRATOS_DB_NAME="$(database_url_part "$KRATOS_DSN" database)"
  KRATOS_DB_SCHEMA="${KRATOS_DB_SCHEMA:-$KRATOS_DB_NAME}"

  AUTHZ_DB_USER="$(database_url_part "$AUTHZ_DATABASE_URL" username)"
  AUTHZ_DB_PASSWORD="$(database_url_part "$AUTHZ_DATABASE_URL" password)"
  AUTHZ_DB_NAME="$(database_url_part "$AUTHZ_DATABASE_URL" database)"
  AUTHZ_DB_SCHEMA="${AUTHZ_DB_SCHEMA:-$AUTHZ_DB_NAME}"

  require_database_part Hydra username "$HYDRA_DB_USER"
  require_database_part Hydra password "$HYDRA_DB_PASSWORD"
  require_database_part Hydra database "$HYDRA_DB_NAME"
  require_database_part Kratos username "$KRATOS_DB_USER"
  require_database_part Kratos password "$KRATOS_DB_PASSWORD"
  require_database_part Kratos database "$KRATOS_DB_NAME"
  require_database_part Authz username "$AUTHZ_DB_USER"
  require_database_part Authz password "$AUTHZ_DB_PASSWORD"
  require_database_part Authz database "$AUTHZ_DB_NAME"

  export HYDRA_DB_USER HYDRA_DB_PASSWORD HYDRA_DB_NAME HYDRA_DB_SCHEMA
  export KRATOS_DB_USER KRATOS_DB_PASSWORD KRATOS_DB_NAME KRATOS_DB_SCHEMA
  export AUTHZ_DB_USER AUTHZ_DB_PASSWORD AUTHZ_DB_NAME AUTHZ_DB_SCHEMA
}
