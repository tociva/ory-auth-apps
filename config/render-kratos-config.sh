#!/bin/sh
set -eu

template="${1:-/etc/config/kratos.tpl.yml}"
output="${2:-/etc/config/kratos.yml}"
tmp="${output}.tmp"

has_apple_provider_config() {
  [ -n "${APPLE_CLIENT_ID:-}" ] &&
    [ -n "${APPLE_TEAM_ID:-}" ] &&
    [ -n "${APPLE_PRIVATE_KEY_ID:-}" ] &&
    [ -n "${APPLE_PRIVATE_KEY:-}" ]
}

has_any_apple_provider_config() {
  [ -n "${APPLE_CLIENT_ID:-}" ] ||
    [ -n "${APPLE_TEAM_ID:-}" ] ||
    [ -n "${APPLE_PRIVATE_KEY_ID:-}" ] ||
    [ -n "${APPLE_PRIVATE_KEY:-}" ]
}

if has_apple_provider_config; then
  envsubst < "$template" > "$tmp"
else
  if has_any_apple_provider_config; then
    echo "Skipping Apple OIDC provider because one or more APPLE_* env vars are missing." >&2
  fi

  awk '
    /# BEGIN optional apple provider/ { skip = 1; next }
    /# END optional apple provider/ { skip = 0; next }
    !skip { print }
  ' "$template" | envsubst > "$tmp"
fi

mv "$tmp" "$output"
