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
# Usage:  ./deploy-dev.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."       # script lives in deploy/, run from repo root

# 1. stop backends
pm2 stop 'ory-auth-dev' 2>/dev/null || true
pm2 stop 'ory-admin-api-dev' 2>/dev/null || true

# 2. docker compose down
docker compose down --remove-orphans

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
docker compose up -d

# 7. (re)start backends
pm2 restart 'ory-auth-dev' 2>/dev/null || pm2 start monorepo/dist/apps/auth-backend/main.cjs --name 'ory-auth-dev'
pm2 restart 'ory-admin-api-dev' 2>/dev/null || pm2 start monorepo/dist/apps/admin-backend/main.cjs --name 'ory-admin-api-dev'
pm2 save
