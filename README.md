# idnest.dev Auth (ORY Hydra + Kratos)

**idnest** is the auth platform (codebase packaged as `@idnest/*`). Identity is
**Google OIDC only** — the login / consent / logout / error pages are
server-rendered by the `auth-backend` Express service; an Angular admin console
manages OAuth clients and identities. One deployment per product; this one
serves the **`daybook.cloud`** product, so its public hosts are `*.daybook.cloud`
(session cookie scoped to `.daybook.cloud`).

Host / port map:

| Production            | Local                          | Port   | Service                                   |
| --------------------- | ------------------------------ | ------ | ----------------------------------------- |
| `auth.daybook.cloud`  | `auth-local.daybook.cloud`     | `4000` | `auth-backend` (login/consent/logout/error) |
| `hydra.daybook.cloud` | `hydra-local.daybook.cloud`    | `4444` | Hydra public (authorize / token / OIDC)   |
| `kratos.daybook.cloud`| `kratos-local.daybook.cloud`   | `4433` | Kratos public (self-service, whoami)      |
| `admin-api.daybook.cloud` | `admin-api-local.daybook.cloud` | `4100` | `admin-backend` API                  |
| `admin.daybook.cloud` | `admin-local.daybook.cloud`    | `4501` | `admin-frontend` console                  |
| `api.daybook.cloud`   | `api-local.daybook.cloud`      | `3001` | daybook product backend (OAuth resource server) |
| `app.daybook.cloud`   | `app-local.daybook.cloud`      | `5173` | daybook product frontend (OAuth client)   |

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

Two PostgreSQL databases, reachable from the containers via
`host.docker.internal:5432`:

| Database | User      | Notes                  |
| -------- | --------- | ---------------------- |
| `hydra`  | `hydrau`  | OAuth2 server state    |
| `kratos` | `kratosu` | identities + sessions  |

Create them as a superuser:

```sql
CREATE USER hydrau  WITH PASSWORD '<hydra_db_password>';
CREATE DATABASE hydra OWNER hydrau;

CREATE USER kratosu WITH PASSWORD '<kratos_db_password>';
CREATE DATABASE kratos OWNER kratosu;
```

Or run the OS-specific helper in [`setup/`](setup/), which creates the
roles/databases **and** runs the migrations (see §9):

```bash
# macOS (Homebrew Postgres — current user is the superuser)
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./setup/setup-ory-macos.sh

# Linux (apt/yum Postgres with a `postgres` OS user)
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./setup/setup-ory-linux.sh
```

> Always run the migrations (§9) **before** starting Hydra/Kratos.

---

## 3. `.env` locations and details

Two env files with different consumers:

**`./.env`** (repo root) — consumed by `docker-compose.yml` and rendered into
`config/kratos.yml` via envsubst. Holds the infra config:
`AUTH_URL`, `CORS_ALLOWED_ORIGINS`, `HYDRA_DSN`, `HYDRA_URLS_*`,
`HYDRA_SECRETS_SYSTEM`, `KRATOS_DSN`, `KRATOS_SERVE_PUBLIC_BASE_URL`,
`KRATOS_ADMIN_URL`, `KRATOS_URLS_LOGOUT`, `KRATOS_COOKIES_DOMAIN`,
`KRATOS_CSRF_COOKIE_SECRET`, `KRATOS_CIPHER_SECRET` (must be **exactly 32 chars**),
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**`monorepo/.env`** (copy from `monorepo/.env.example`) — consumed by the
backends:
`HYDRA_ADMIN_URL`, `KRATOS_ADMIN_URL`, `KRATOS_PUBLIC_URL`, `AUTH_BASE_URL`,
`AUTH_BACKEND_PORT`, `ADMIN_BACKEND_PORT`, `CORS_ALLOWED_ORIGINS`,
`ADMIN_BOOTSTRAP_EMAILS`.

```bash
cd monorepo && cp .env.example .env   # then fill in values
```

Two rules that trip people up:

- `AUTH_URL` (infra) and `AUTH_BASE_URL` (apps) must be the **same origin**
  (`https://auth-local.daybook.cloud`) — Kratos rejects the post-login return
  otherwise.
- `KRATOS_PUBLIC_URL` (apps) must be the **browser-reachable** Kratos host
  (`https://kratos-local.daybook.cloud`), not an internal docker name —
  auth-backend redirects the browser there and forwards the session cookie.

Both files are gitignored. See `docs/README-detailed.md` for the full wiring
table and example values.

---

## 4. nginx + local certificate

**1. `/etc/hosts`:**

```bash
sudo tee -a /etc/hosts >/dev/null <<'EOF'
127.0.0.1 auth-local.daybook.cloud hydra-local.daybook.cloud kratos-local.daybook.cloud admin-api-local.daybook.cloud admin-local.daybook.cloud api-local.daybook.cloud app-local.daybook.cloud
EOF
```

**2. Certificate** (one cert covers all hosts):

```bash
brew install mkcert nss
mkcert -install

sudo mkdir -p /opt/homebrew/etc/nginx/ssl
cd /opt/homebrew/etc/nginx/ssl
sudo mkcert -cert-file local.daybook.cloud.pem -key-file local.daybook.cloud-key.pem \
  auth-local.daybook.cloud hydra-local.daybook.cloud kratos-local.daybook.cloud \
  admin-api-local.daybook.cloud admin-local.daybook.cloud \
  api-local.daybook.cloud app-local.daybook.cloud
```

**3. Reverse proxy** — ready-made configs live in
[`deploy/nginx/`](deploy/nginx/) (`idnest-local.conf`, `idnest-prod.conf`):

```bash
sudo cp deploy/nginx/idnest-local.conf /opt/homebrew/etc/nginx/servers/
sudo nginx -t && sudo brew services restart nginx
```

Each block terminates TLS and forwards `X-Forwarded-Proto https` (Hydra/Kratos
need it to build correct `https://` URLs).

---

## 5. Start / stop each application locally

```bash
# 1. Hydra + Kratos (from repo root). Run migrations first — see §9.
docker compose up -d
docker compose logs -f ory-kratos          # watch until ready; Ctrl-C to detach

# 2. Register the OAuth clients (first run, or after editing tools/apps.config.json)
cd monorepo
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:clients

# 3. Backends — each in its own terminal, from monorepo/
pnpm auth-backend:serve     # :4000
pnpm admin-backend:serve    # :4100  (optional)
pnpm admin-frontend:serve   # :4501  (optional)
```

Start the daybook **product** apps (backend `:3001`, frontend `:5173`) from their
own repo.

Verify, then stop:

```bash
curl -k https://kratos-local.daybook.cloud/health/ready
curl http://localhost:4000/health

# stop: Ctrl-C each serve terminal, then from repo root:
docker compose down
```

> After editing `.env` or `config/kratos.tpl.yml`, re-render Kratos:
> `docker compose up -d --force-recreate ory-kratos`. The `pnpm serve` tasks run
> with `tsx watch` / Angular dev-server, so code edits auto-reload.

---

## 6. Build and deploy

```bash
cd monorepo
pnpm build      # backend bundles + admin-frontend static build
```

Production:

- Use the bare `*.daybook.cloud` hosts; set `AUTH_URL`, `AUTH_BASE_URL`,
  `KRATOS_SERVE_PUBLIC_BASE_URL`, `KRATOS_PUBLIC_URL` accordingly.
- Run the backend bundles with a process manager, e.g.
  `node dist/apps/auth-backend/main.cjs` and `node dist/apps/admin-backend/main.cjs`
  (pm2/systemd/container).
- Serve the `admin-frontend` build as static files.
- Front everything with [`deploy/nginx/idnest-prod.conf`](deploy/nginx/idnest-prod.conf)
  (wildcard `*.daybook.cloud` cert).
- Run migrations (§9) before first start; recreate Kratos after config changes.
- Keep Hydra admin (`4445`) and Kratos admin (`4434`) on a private network; use
  managed PostgreSQL and inject secrets from a secret manager.

---

## 7. Examples for a client project

Each product app is its own Hydra OAuth client (Authorization Code + PKCE) that
redirects to `auth.daybook.cloud`. Define it in
[`monorepo/tools/apps.config.json`](monorepo/tools/apps.config.json), then run
`pnpm hydra:clients`:

```json
{
  "client_id": "daybook-user-client",
  "public": true,
  "scope": "openid profile email offline_access",
  "redirect_uris": ["https://app.daybook.cloud/auth/callback"],
  "post_logout_redirect_uris": ["https://app.daybook.cloud/auth/logout"],
  "audience": ["daybook.cloud-users"]
}
```

Client SDK config (using [`oidc-client-ts`](https://github.com/authts/oidc-client-ts)):

```ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://hydra.daybook.cloud/",              // OIDC issuer
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

Discovery: `https://hydra.daybook.cloud/.well-known/openid-configuration`.
Raw authorize URL and token-exchange details are in `docs/README-detailed.md` §7.

---

## 8. Google setup

1. Go to `console.cloud.google.com/apis/credentials`.
2. Select the OAuth client (or create a **Web application** client).
3. Add the Kratos OIDC callback under **Authorized redirect URIs**, e.g.
   `https://kratos-dev.daybook.cloud/self-service/methods/oidc/callback/google`
   (local: `https://kratos-local.daybook.cloud/...`,
   prod: `https://kratos.daybook.cloud/...`).
4. Put the client id/secret into the infra `./.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.

The callback path is fixed by Kratos: `self-service/methods/oidc/callback/<provider-id>`
(`google`).

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
```

(The `setup/setup-ory-*.sh` helper in §2 runs both for you.)

---

## 10. Detailed reference

For the full architecture, per-variable wiring tables, the server-rendered auth
flow, raw OAuth URLs, debug commands, and security notes, see
[`docs/README-detailed.md`](docs/README-detailed.md) and
[`MIGRATION_PLAN.md`](MIGRATION_PLAN.md).
