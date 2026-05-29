# Daybook.cloud Auth (ORY Hydra + Kratos)

Authentication and authorization for Daybook.cloud, built on the **ORY**
ecosystem. Identity is **Google OIDC only** (no local username/password). The
login / consent / logout UI and its privileged admin proxy have been split out
of the original Next.js app into an Nx monorepo: an **Angular** frontend and a
**TypeScript Express** backend.

See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for the full migration history and
roadmap (Phase 1 fixes, Phase 2 restructure, Phase 3 admin UI).

---

## Architecture

| Component             | Tech                       | Role                                                              |
| --------------------- | -------------------------- | ----------------------------------------------------------------- |
| ORY Hydra `v2.3.0`    | Docker image               | OAuth2 / OpenID Connect server: issues tokens, owns login/consent/logout challenges |
| ORY Kratos `v1.3.1`   | Docker image               | Identity provider: runs the Google OIDC login flow, stores identities, sessions |
| `auth-backend`        | TypeScript + Express       | Narrow Hydra/Kratos **admin** proxy for accept-login/consent/logout (admin URLs stay server-side) |
| `auth-frontend`       | Angular 21 + TailNG        | Public login / consent / logout / error UI                        |
| `shared-types`        | TypeScript library         | Shared Kratos/Hydra interfaces + runtime guards                   |
| PostgreSQL            | external                   | Separate `hydra` and `kratos` databases                           |

`auth-backend` and `auth-frontend` live in [`monorepo/`](monorepo/). Hydra +
Kratos stay as Docker images orchestrated by [`docker-compose.yml`](docker-compose.yml).
Cookie domain `.daybook.cloud` provides SSO across subdomains.

### Repository layout

```
.
├── config/                  # Kratos config (kratos.tpl.yml -> kratos.yml via envsubst)
├── Dockerfile.kratos        # Kratos image that renders the template at startup
├── docker-compose.yml       # Hydra + Kratos services
├── .env                      # Infra secrets/DSNs consumed by docker-compose (gitignored)
├── create-hydra-client.js   # Legacy single-client helper (superseded by monorepo/tools)
├── setup-ory.sh             # Ory bootstrap helper
└── monorepo/                # Nx workspace (pnpm)
    ├── apps/
    │   ├── auth-backend/    # Express API (Hydra/Kratos admin proxy)
    │   └── auth-frontend/   # Angular + TailNG UI
    ├── libs/shared-types/   # Shared types + runtime guards
    ├── tools/               # create-hydra-clients.mjs + apps.config.json
    └── .env.example         # App config (copy to monorepo/.env)
```

---

## Auth flow

1. A product app sends the user to Hydra's authorize endpoint.
2. Hydra redirects to the `auth-frontend` **login** page with a `login_challenge`.
3. The login page starts the Kratos browser login flow and submits the
   `csrf_token` with a full-page POST to Google (OIDC).
4. After Google returns, `handle-login-return` polls Kratos `whoami`, then calls
   `auth-backend` → Hydra **accept-login**.
5. Hydra redirects to the **consent** page, which calls `auth-backend` → Hydra
   **accept-consent**, granting exactly the requested scope/audience.
6. Hydra issues tokens and redirects back to the product app.
7. **Logout** terminates both the Kratos session and the Hydra session.

---

## Prerequisites

- **Node** `>= 22` (the workspace is pinned to `22.22.0` via `monorepo/.nvmrc`)
- **pnpm** `9.15.0` (provisioned by Corepack)
- **Docker** + **Docker Compose**
- **PostgreSQL** reachable from the containers (via `host.docker.internal`)

```bash
nvm use 22          # or: nvm install 22.22.0
corepack enable     # makes the pnpm version in package.json available
```

> The repo root is pnpm-only now. pnpm for the apps must be run from inside
> `monorepo/` (its `package.json` pins `pnpm@9.15.0`).

---

## Quick start

### 1. Create the databases

Connect as a superuser and create separate users/databases (use strong,
unique passwords and inject them via your secret manager — do not commit them):

```sql
-- Hydra
CREATE USER hydrau WITH PASSWORD '<hydra_db_password>';
CREATE DATABASE hydra OWNER hydrau;
GRANT ALL PRIVILEGES ON DATABASE hydra TO hydrau;

-- Kratos
CREATE USER kratosu WITH PASSWORD '<kratos_db_password>';
CREATE DATABASE kratos OWNER kratosu;
GRANT ALL PRIVILEGES ON DATABASE kratos TO kratosu;
```

### 2. Configure infra env

Create `.env` at the repo root (consumed by `docker-compose.yml`). Required keys:

```
# App URLs
AUTH_URL, CORS_ALLOWED_ORIGINS

# Hydra
HYDRA_ADMIN_URL, HYDRA_DSN, HYDRA_URLS_SELF_ISSUER,
HYDRA_URLS_CONSENT, HYDRA_URLS_LOGIN, HYDRA_URLS_LOGOUT, HYDRA_URLS_ERROR,
HYDRA_SECRETS_SYSTEM

# Kratos
KRATOS_DSN, KRATOS_SERVE_PUBLIC_BASE_URL, KRATOS_ADMIN_URL, KRATOS_URLS_LOGOUT,
KRATOS_COOKIES_DOMAIN, KRATOS_CSRF_COOKIE_SECRET, KRATOS_CIPHER_SECRET

# Google OIDC
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

### 3. Run database migrations

```bash
# Hydra
docker run --rm --network host \
  -e DSN='postgres://hydrau:<password>@127.0.0.1:5432/hydra?sslmode=disable' \
  oryd/hydra:v2.3.0 migrate sql up -e --yes

# Kratos
docker run --rm --network host \
  -e DSN='postgres://kratosu:<password>@127.0.0.1:5432/kratos?sslmode=disable' \
  -v "$PWD/config:/etc/config" \
  oryd/kratos:v1.3.1 migrate sql -e --yes
```

### 4. Start Hydra + Kratos

```bash
docker compose up -d
docker compose logs -f ory-kratos
```

Verify Kratos locally: open
`http://localhost:4433/self-service/login/browser`.

### 5. Register Hydra OAuth clients (one per app)

Define apps in [`monorepo/tools/apps.config.json`](monorepo/tools/apps.config.json),
then:

```bash
cd monorepo
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:clients
```

Public SPAs are created with `token_endpoint_auth_method=none`, which makes
Hydra require **PKCE**.

### 6. Install and run the apps

```bash
cd monorepo
cp .env.example .env        # then fill in real values
pnpm install
```

All commands below are run from `monorepo/`.

---

## Develop, test, lint

### Start each app

| App            | Command                     | URL / how to open                                                  |
| -------------- | --------------------------- | ------------------------------------------------------------------ |
| `auth-backend` | `pnpm auth-backend:serve`   | API on `http://localhost:4000` — health check: `curl http://localhost:4000/health` |
| `auth-frontend`| `pnpm auth-frontend:serve`  | open `http://localhost:4200` in a browser (it redirects to `/login`) |

```bash
pnpm auth-backend:serve      # Express API on :4000 (tsx watch, auto-reload)
pnpm auth-frontend:serve     # Angular dev server on :4200 (open in browser)
```

> The frontend's login flow needs Hydra + Kratos running (steps 4–5) and a
> `login_challenge`, so start them via a product app's OAuth redirect. You can
> still open `http://localhost:4200/login` directly to load the UI.

### Test

```bash
pnpm test                    # vitest across all projects
pnpm exec nx test auth-backend     # a single project
pnpm exec nx test shared-types
pnpm exec nx watch --all -- nx test  # optional: watch mode via Nx
```

### Lint

ESLint uses flat config in TypeScript (`eslint.config.ts` per project, extending
the workspace `eslint.config.ts`). Rules: `typescript-eslint` recommended,
`angular-eslint` for the frontend (TS + inline templates), and the Nx
module-boundary rule (apps may depend on `shared-types`, not on each other).

```bash
pnpm lint                    # lint all projects
pnpm exec nx lint auth-frontend          # a single project
pnpm exec nx lint auth-backend --fix     # auto-fix where possible
```

### Type-check and build

```bash
pnpm typecheck               # tsc --noEmit across all projects
pnpm build                   # build every project (backend bundle + Angular app)
pnpm exec nx build auth-frontend         # a single project
```

### Register OAuth clients

```bash
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:clients
```

---

## Environment variables

- **Infra** (`./.env`) — DSNs, Hydra/Kratos URLs and secrets, Google
  credentials. Consumed by `docker-compose.yml`.
- **Apps** (`monorepo/.env`, from `monorepo/.env.example`) — the backends'
  `HYDRA_ADMIN_URL`, `KRATOS_ADMIN_URL`, `KRATOS_PUBLIC_URL`, ports, and
  `CORS_ALLOWED_ORIGINS`.
- **Frontends** — browser-public config is loaded at runtime from each app's
  `public/config.json` (build-once / deploy-many), so a single build can target
  any environment by swapping that file at deploy time:
  - `apps/auth-frontend/public/config.json`
  - `apps/admin-frontend/public/config.json`

The Hydra/Kratos **admin** URLs are read server-side only and are never shipped
to the browser.

---

## Google OIDC setup

1. Go to `console.cloud.google.com/apis/credentials`.
2. Select the OAuth client and add the Kratos OIDC callback as an authorized
   redirect URI, e.g.
   `https://kratos-dev.daybook.cloud/self-service/methods/oidc/callback/google`.
3. Put the client id/secret into the infra `.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

---

## Local HTTPS (optional, for subdomain testing)

Run nginx locally with the `*-local.daybook.cloud` subdomains pointed at the
services (update `/etc/hosts`), and trust a local certificate:

```bash
mkcert -cert-file local.daybook.cloud.pem -key-file local.daybook.cloud-key.pem \
  hydra-local.daybook.cloud \
  auth-local.daybook.cloud \
  kratos-local.daybook.cloud \
  api-local.daybook.cloud \
  app-local.daybook.cloud \
  app-dev.daybook.cloud
sudo cp *.pem /opt/homebrew/etc/nginx/ssl/
sudo brew services restart nginx
```

---

## Debug

```bash
# List / delete identities (Kratos admin API)
curl -s http://localhost:4434/admin/identities | jq .
curl -X DELETE http://localhost:4434/admin/identities/<identity-id>

# Inspect the rendered Kratos config inside the container
docker exec -it ory-kratos cat /etc/config/kratos.yml

# Recreate the stack
docker compose down --remove-orphans
docker compose up -d
docker logs ory-kratos
```

---

## Security notes

- **Google-only**: other social providers were removed; only Google OIDC is
  configured in Kratos.
- **Rotate secrets**: the Google client secret, `HYDRA_SECRETS_SYSTEM`, both DB
  passwords, and the Kratos cookie/cipher secrets were present in the working
  tree historically and must be considered compromised — rotate them and move
  to a secret manager / env injection for deploys (see `MIGRATION_PLAN.md` §1.2).
- No local credentials are stored; only federated identities.
- For production: enforce HTTPS everywhere, use persistent databases, and keep
  admin APIs (`:4434`, `:4445`) off the public internet.
