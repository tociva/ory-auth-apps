#!/usr/bin/env bash
#
# Steps:
#   1. pm2 stop backends
#   2. docker compose down (remove orphans)
#   3. git pull
#   4. pnpm build
#   5. copy env files from ../ory.root.env and ../ory.monorepo.env
#   6. docker compose up -d
#   7. pm2 (re)start backends
#
# Usage:  ./scripts/deploy/deploy-dev.sh
#
set -eu
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker/docker-compose.yml"
cd "$REPO_ROOT"

# 1. stop backends
pm2 stop 'ory-auth-dev' 2>/dev/null || true
pm2 stop 'ory-admin-backend-dev' 2>/dev/null || true

# 2. docker compose down
docker compose -f "$COMPOSE_FILE" down --remove-orphans

# 3. git pull
git pull --ff-only

# 4. build
cd monorepo
pnpm build
cd ..

# 5. copy env files
cp -f ../ory.root.env .env
cp -f ../ory.monorepo.env monorepo/.env

# 6. docker compose up
docker compose -f "$COMPOSE_FILE" up -d --build

# 7. (re)start backends
# Run from monorepo/ so the bundle's `dotenv/config` loads monorepo/.env
# (KRATOS_PUBLIC_URL, AUTH_BASE_URL, ...). delete+start because pm2 restart
# keeps the old working directory.
MONO="$PWD/monorepo"
pm2 delete 'ory-auth-dev' 'ory-admin-backend-dev' 2>/dev/null || true
pm2 start "$MONO/dist/apps/auth-backend/main.cjs"  --name 'ory-auth-dev'      --cwd "$MONO"
pm2 start "$MONO/dist/apps/admin-backend/main.cjs" --name 'ory-admin-backend-dev' --cwd "$MONO"
pm2 save
