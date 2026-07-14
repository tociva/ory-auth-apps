# idnest.dev Auth (ORY Hydra + Kratos)

**idnest** is the auth platform (codebase packaged as `@idnest/*`). Identity is
**Google + Apple OIDC** — the login / consent / logout / error pages are
server-rendered by the `auth-backend` Express service; an Angular admin console
manages OAuth clients and identities. One deployment per product; this one
serves the **`daybook.cloud`** product. Auth/identity infrastructure runs on
`*.idnest.cloud` (session cookie scoped to `.idnest.cloud`); the product app and
API remain on `*.daybook.cloud`.

Host / port map:

| Production              | Local                            | Port   | Service                                   |
| ----------------------- | -------------------------------- | ------ | ----------------------------------------- |
| `auth.idnest.cloud`     | `auth-local.idnest.cloud`        | `4000` | `auth-backend` (login/consent/logout/error) |
| `hydra.idnest.cloud`    | `hydra-local.idnest.cloud`       | `4444` | Hydra public (authorize / token / OIDC)   |
| `kratos.idnest.cloud`   | `kratos-local.idnest.cloud`      | `4433` | Kratos public (self-service, whoami)      |
| `admin.idnest.cloud`    | `admin-local.idnest.cloud`       | `4501`/`4100` | admin UI + same-origin BFF API     |
| `api.daybook.cloud`     | `api-local.daybook.cloud`        | `3001` | daybook product backend (OAuth resource server) |
| `app.daybook.cloud`     | `app-local.daybook.cloud`        | `5173` | daybook product frontend (OAuth client)   |

Hydra admin (`4445`) and Kratos admin (`4434`) stay on localhost — never public.

---

## 1. Set up the project on a local machine

Prerequisites: **Node ≥ 22**, **pnpm 9.15** (via Corepack), **Docker** + Compose,
**PostgreSQL**, and **nginx** + **mkcert** for local HTTPS.

```bash
git clone <this-repo> ory-auth-apps
cd ory-auth-apps/monorepo

nvm use 22            # or: nvm install 22.22.0
corepack enable      # provides the pinned pnpm version

pnpm install
pnpm build           # builds auth-backend, admin-backend, admin-frontend, shared-types
```

---

## 2. Database details and initial setup

Three PostgreSQL databases, reachable from the containers via
`host.docker.internal:5432`, each with a dedicated schema:

| Database | Schema   | User      | Notes                  |
| -------- | -------- | --------- | ---------------------- |
| `hydra`  | `hydra`  | `hydrau`  | OAuth2 server state    |
| `kratos` | `kratos` | `kratosu` | identities + sessions  |
| `authz`  | `authz`  | `authzu`  | client access + consent approvals |

Create them as a superuser:

```sql
CREATE USER hydrau  WITH PASSWORD '<hydra_db_password>';
CREATE DATABASE hydra OWNER hydrau;
CREATE SCHEMA hydra AUTHORIZATION hydrau;
ALTER ROLE hydrau IN DATABASE hydra SET search_path = hydra, public;

CREATE USER kratosu WITH PASSWORD '<kratos_db_password>';
CREATE DATABASE kratos OWNER kratosu;
CREATE SCHEMA kratos AUTHORIZATION kratosu;
ALTER ROLE kratosu IN DATABASE kratos SET search_path = kratos, public;

CREATE USER authzu WITH PASSWORD '<authz_db_password>';
CREATE DATABASE authz OWNER authzu;
CREATE SCHEMA authz AUTHORIZATION authzu;
ALTER ROLE authzu IN DATABASE authz SET search_path = authz, public;
```

For a new local machine, use the bootstrap script after filling both env files:

```bash
cp .env.example .env
cd monorepo && cp .env.example .env && cd ..
./scripts/bootstrap-local.sh
```

Or run the OS-specific helper in [`scripts/setup/`](scripts/setup/), which creates
the roles/databases/schemas **and** runs the ORY migrations (see §9):

```bash
# macOS (Homebrew Postgres — current user is the superuser)
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./scripts/setup/setup-ory-macos.sh

# Linux (apt/yum Postgres with a `postgres` OS user)
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./scripts/setup/setup-ory-linux.sh
```

> Always run the migrations (§9) **before** starting Hydra/Kratos.

---

## 3. `.env` locations and details

Two env files with different consumers:

**`./.env`** (repo root, copy from `.env.example`) — consumed by
`scripts/docker/docker-compose.yml` and rendered into
`config/kratos.yml` via envsubst. Holds the infra config:
`AUTH_URL`, `CORS_ALLOWED_ORIGINS`, `HYDRA_DSN`, `HYDRA_URLS_*`,
`HYDRA_SECRETS_SYSTEM`, `KRATOS_DSN`, `KRATOS_SERVE_PUBLIC_BASE_URL`,
`KRATOS_ADMIN_URL`, `KRATOS_URLS_LOGOUT`, `KRATOS_COOKIES_DOMAIN`,
`KRATOS_CSRF_COOKIE_SECRET`, `KRATOS_CIPHER_SECRET` (must be **exactly 32 chars**),
`HYDRA_DB_SCHEMA`, `KRATOS_DB_SCHEMA`, `AUTHZ_DB_SCHEMA`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Apple is optional; the Kratos
renderer includes the Apple provider only when `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`,
`APPLE_PRIVATE_KEY_ID`, and `APPLE_PRIVATE_KEY` are all set.

**`monorepo/.env`** (copy from `monorepo/.env.example`) — consumed by the
backends:
`HYDRA_ADMIN_URL`, `KRATOS_ADMIN_URL`, `KRATOS_PUBLIC_URL`, `AUTH_BASE_URL`,
`AUTH_BACKEND_PORT`, `ADMIN_BACKEND_PORT`, `ADMIN_CORS_ALLOWED_ORIGINS`,
`ADMIN_CSRF_SECRET`, `AUTHZ_DATABASE_URL`, `CONSENT_GATE_MODE`,
`CONSENT_ACTION_SECRET`, `ADMIN_PUBLIC_ORIGIN`, `ADMIN_OIDC_CLIENT_SECRET`,
`ADMIN_BOOTSTRAP_IDENTITY_IDS`, `ADMIN_API_BASE_URL`, `ADMIN_AUTH_LOGOUT_URL`.

```bash
cd monorepo && cp .env.example .env   # then fill in values
```

Two rules that trip people up:

- `AUTH_URL` (infra) and `AUTH_BASE_URL` (apps) must be the **same origin**
  (`https://auth-local.idnest.cloud`) — Kratos rejects the post-login return
  otherwise.
- `KRATOS_PUBLIC_URL` (apps) must be the **browser-reachable** Kratos host
  (`https://kratos-local.idnest.cloud`), not an internal docker name —
  auth-backend redirects the browser there and forwards the session cookie.

Both files are gitignored. See `docs/README-detailed.md` for the full wiring
table and example values.

---

## 4. nginx + local certificate

**1. `/etc/hosts`:**

```bash
sudo tee -a /etc/hosts >/dev/null <<'EOF'
127.0.0.1 auth-local.idnest.cloud
127.0.0.1 hydra-local.idnest.cloud
127.0.0.1 kratos-local.idnest.cloud
127.0.0.1 admin-local.idnest.cloud
127.0.0.1 api-local.daybook.cloud
127.0.0.1 app-local.daybook.cloud
EOF
```

**2. Certificate** (one cert covers all hosts):

```bash
brew install mkcert nss
mkcert -install

sudo mkdir -p /opt/homebrew/etc/nginx/ssl
cd /opt/homebrew/etc/nginx/ssl
sudo mkcert -cert-file local.idnest.cloud.pem -key-file local.idnest.cloud-key.pem \
  auth-local.idnest.cloud hydra-local.idnest.cloud kratos-local.idnest.cloud \
  admin-local.idnest.cloud

sudo mkcert -cert-file local.daybook.cloud.pem -key-file local.daybook.cloud-key.pem \
  api-local.daybook.cloud app-local.daybook.cloud

# Below section for both idnest and daybook confs
sudo chown -R $(whoami):admin /opt/homebrew/etc/nginx/ssl
sudo chmod 755 /opt/homebrew/etc/nginx/ssl
sudo chmod 644 /opt/homebrew/etc/nginx/ssl/local.idnest.cloud.pem
sudo chmod 600 /opt/homebrew/etc/nginx/ssl/local.idnest.cloud-key.pem
```

**3. Reverse proxy** — ready-made configs live in
[`scripts/deploy/nginx/`](scripts/deploy/nginx/):

```bash
sudo cp scripts/deploy/nginx/local/*.conf /opt/homebrew/etc/nginx/servers/
sudo nginx -t && sudo brew services restart nginx
```

Each block terminates TLS and forwards `X-Forwarded-Proto https` (Hydra/Kratos
need it to build correct `https://` URLs).

---

## 5. Start / stop each application locally

```bash
# 1. Hydra + Kratos (from repo root). Run migrations first — see §9.
docker compose -f scripts/docker/docker-compose.yml up -d
docker compose -f scripts/docker/docker-compose.yml logs -f ory-kratos

# 2. Run authz migrations and seed the first admin Kratos identity ID
cd monorepo
pnpm authz:migrate
ADMIN_BOOTSTRAP_IDENTITY_IDS=<kratos-identity-id> pnpm authz:seed

# 3. Register the confidential admin OAuth client
HYDRA_ADMIN_URL=http://localhost:4445 ADMIN_OIDC_CLIENT_SECRET=<secret> pnpm hydra:admin-client

# 4. Backends — each in its own terminal, from monorepo/
pnpm auth-backend:serve     # :4000
pnpm admin-backend:serve    # :4100  (required for admin BFF)
pnpm admin-frontend:serve   # :4501
```
Start the daybook **product** apps (backend `:3001`, frontend `:5173`) from their
own repo.

Verify, then stop:

```bash
curl -k https://kratos-local.idnest.cloud/health/ready
curl http://localhost:4000/health

# stop: Ctrl-C each serve terminal, then from repo root:
docker compose -f scripts/docker/docker-compose.yml down
```

> After editing `.env` or `config/kratos.tpl.yml`, re-render Kratos:
> `docker compose -f scripts/docker/docker-compose.yml up -d --force-recreate ory-kratos`. The `pnpm serve` tasks run
> with `tsx watch` / Angular dev-server, so code edits auto-reload.

---

## 6. Build and deploy

```bash
cd monorepo
pnpm build      # backend bundles + admin-frontend static build
```

Run backend bundles with PM2 from `monorepo/` so `dotenv/config` loads
`monorepo/.env`:

```bash
pm2 delete idnest-auth-backend idnest-admin-backend 2>/dev/null || true
pm2 start dist/apps/auth-backend/main.cjs --name idnest-auth-backend --cwd "$PWD"
pm2 start dist/apps/admin-backend/main.cjs --name idnest-admin-backend --cwd "$PWD"
pm2 save
```

Production:

- Use the bare `*.idnest.cloud` hosts for auth/Hydra/Kratos/admin; set `AUTH_URL`,
  `AUTH_BASE_URL`, `KRATOS_SERVE_PUBLIC_BASE_URL`, `KRATOS_PUBLIC_URL` accordingly.
- Run the backend bundles with a process manager, e.g.
  `node dist/apps/auth-backend/main.cjs` and `node dist/apps/admin-backend/main.cjs`
  (pm2/systemd/container).
- Serve the `admin-frontend` build as static files.
- Front everything with [`scripts/deploy/nginx/prod/`](scripts/deploy/nginx/prod/)
  (wildcard `*.idnest.cloud` cert for auth/admin services; `*.daybook.cloud` cert for product apps).
- Run migrations (§9) before first start; recreate Kratos after config changes.
- Keep Hydra admin (`4445`) and Kratos admin (`4434`) on a private network; use
  managed PostgreSQL and inject secrets from a secret manager.

---

## 7. Examples for a client project

Each product app is its own Hydra OAuth client (Authorization Code + PKCE) that
redirects to `auth.idnest.cloud`. Create product clients from the admin portal.
The bootstrap script only creates the protected Idnest admin client.

```json
{
  "client_id": "daybook-user-client",
  "public": true,
  "scope": "openid profile email offline_access",
  "metadata": {
    "trust_tier": "first_party",
    "consent_version": 1,
    "remember_offline_access": true
  },
  "redirect_uris": ["https://app.daybook.cloud/auth/callback"],
  "post_logout_redirect_uris": ["https://app.daybook.cloud/auth/logout"],
  "audience": ["daybook.cloud-users"]
}
```

Client SDK config (using [`oidc-client-ts`](https://github.com/authts/oidc-client-ts)):

```ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://hydra.idnest.cloud/",               // OIDC issuer
  client_id: "daybook-user-client",
  redirect_uri: "https://app.daybook.cloud/auth/callback",
  post_logout_redirect_uri: "https://app.daybook.cloud/auth/logout",
  response_type: "code",                                  // PKCE auto-applied
  scope: "openid profile email offline_access",
  extraQueryParams: { audience: "daybook.cloud-users" },
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});
// login:  userManager.signinRedirect()
// callback: userManager.signinRedirectCallback()
// logout: userManager.signoutRedirect()
```

Discovery: `https://hydra.idnest.cloud/.well-known/openid-configuration`.
Raw authorize URL and token-exchange details are in `docs/README-detailed.md` §7.

---

## 8. Social provider setup

Google:

1. Go to `console.cloud.google.com/apis/credentials`.
2. Select the OAuth client (or create a **Web application** client).
3. Add the Kratos OIDC callback under **Authorized redirect URIs**, e.g.
   `https://kratos-dev.idnest.cloud/self-service/methods/oidc/callback/google`
   (local: `https://kratos-local.idnest.cloud/...`,
   prod: `https://kratos.idnest.cloud/...`).
4. Put the client id/secret into the infra `./.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.

Apple:

1. In Apple Developer, configure Sign in with Apple for the Services ID used by
   Kratos.
2. Add the Kratos OIDC callback for Apple, e.g.
   `https://kratos-dev.idnest.cloud/self-service/methods/oidc/callback/apple`
   (local: `https://kratos-local.idnest.cloud/...`,
   prod: `https://kratos.idnest.cloud/...`).
3. Put the Services ID, Team ID, key ID, and private key into the infra `./.env`
   as `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_PRIVATE_KEY_ID`, and
   `APPLE_PRIVATE_KEY`.

The callback path is fixed by Kratos: `self-service/methods/oidc/callback/<provider-id>`
(`google` or `apple`). The Apple provider is rendered only when all Apple env vars
are present, so Google-only local setups can start without placeholder Apple
credentials.

This self-hosted Kratos v25.4.0 config uses the default explicit linking flow.
Provider logins without a verified email are rejected before Hydra issues tokens.

---

## 9. Run the migrations before starting Hydra/Kratos

```bash
# Hydra
docker run --rm --network host \
  -e DSN='postgres://hydrau:<password>@127.0.0.1:5432/hydra?sslmode=disable' \
  oryd/hydra:v26.2.0 migrate sql up -e --yes

# Kratos (needs the config volume)
docker run --rm --network host \
  -e DSN='postgres://kratosu:<password>@127.0.0.1:5432/kratos?sslmode=disable' \
  -v "$PWD/config:/etc/config" \
  oryd/kratos:v25.4.0 migrate sql -e --yes

# Authz consent/client-access store
cd monorepo
AUTHZ_DATABASE_URL='postgres://authzu:<password>@127.0.0.1:5432/authz?sslmode=disable' pnpm authz:migrate
AUTHZ_DATABASE_URL='postgres://authzu:<password>@127.0.0.1:5432/authz?sslmode=disable' pnpm authz:seed
```

(The `scripts/setup/setup-ory-*.sh` helper in §2 runs the ORY migrations for you;
`scripts/bootstrap-local.sh` also runs authz migration and admin client creation.)

---

## 10. Detailed reference

For the full architecture, per-variable wiring tables, the server-rendered auth
flow, raw OAuth URLs, debug commands, and security notes, see
[`docs/README-detailed.md`](docs/README-detailed.md) and
[`MIGRATION_PLAN.md`](MIGRATION_PLAN.md).

## 11. Clear google account to start the whole login flow
```
1. Go to https://myaccount.google.com/connections
2. Delete all connections you have with <app name>
```
