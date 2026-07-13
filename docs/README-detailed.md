# idnest.dev Auth (ORY Hydra + Kratos)

**idnest** is the auth platform (the codebase, packaged as `@idnest/*`).
Identity is **Google + Apple OIDC** (no local username/password). The public login
/ consent / logout / error pages are **server-rendered by the `auth-backend`
Express service** (the former Angular `auth-frontend` SPA was removed); a
separate Angular admin console manages clients and identities.

**Brand vs. deployment**

- The **brand / project** is **idnest** — package names (`@idnest/*`), the nginx
  config files under `scripts/deploy/nginx/`, and this title all carry it.
- This **deployment serves the `daybook.cloud` product**. Auth/identity
  infrastructure runs on `*.idnest.cloud` (session cookie scoped to `.idnest.cloud`).
  Product apps and APIs remain on `*.daybook.cloud`. Each product app is its own
  Hydra OAuth client that redirects to `auth.idnest.cloud` and receives tokens.

See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for the full migration history.

---

## Architecture

| Component             | Tech                       | Role                                                              |
| --------------------- | -------------------------- | ----------------------------------------------------------------- |
| ORY Hydra `v26.2.0`    | Docker image               | OAuth2 / OpenID Connect server: issues tokens, owns login/consent/logout challenges |
| ORY Kratos `v25.4.0`   | Docker image               | Identity provider: runs Google/Apple OIDC login flows, stores identities, sessions |
| `auth-backend`        | TypeScript + Express       | Hydra/Kratos **admin** proxy **and** server-rendered login/consent/logout/error pages (admin URLs stay server-side) |
| `admin-backend`       | TypeScript + Express       | Privileged admin API (identities, clients, roles)                 |
| `admin-frontend`      | Angular 21 + TailNG        | Staff-only admin console                                          |
| `shared-types`        | TypeScript library         | Shared Kratos/Hydra interfaces + runtime guards                   |
| PostgreSQL            | external                   | Separate `hydra`, `kratos`, and `authz` databases with dedicated schemas |

The apps live in [`monorepo/`](../monorepo/). Hydra + Kratos run as Docker
images orchestrated by [`scripts/docker/docker-compose.yml`](../scripts/docker/docker-compose.yml).

### Repository layout

```
.
├── config/                  # Kratos config (kratos.tpl.yml -> kratos.yml via envsubst)
│   └── kratos/               # identity schema + OIDC claims mappers
├── scripts/
│   ├── bootstrap-local.sh    # local one-shot bootstrap
│   ├── docker/               # Docker compose + Kratos image/render script
│   ├── setup/                # DB bootstrap + ORY migrations
│   └── deploy/nginx/         # nginx reverse-proxy configs
├── .env                      # Infra secrets/DSNs consumed by docker-compose (gitignored)
└── monorepo/                # Nx workspace (pnpm)
    ├── apps/
    │   ├── auth-backend/    # Express: admin proxy + server-rendered auth pages
    │   │   └── src/app/
    │   │       ├── handlers/   # Hydra/Kratos admin calls (accept-login/consent/logout)
    │   │       ├── views/      # login + error HTML templates (+ inlined CSS)
    │   │       ├── kratos-public.ts  # cookie-forwarding Kratos public client
    │   │       └── pages.ts    # GET /login, /login/return, /consent, /logout, /error
    │   ├── admin-backend/   # Express privileged admin API
    │   └── admin-frontend/  # Angular + TailNG admin console
    ├── libs/shared-types/   # Shared types + runtime guards
    ├── tools/               # seed app config for authz grants
    └── .env.example         # App config (copy to monorepo/.env)
```

---

# Setup — step by step

Hostnames and ports. **Production** uses the bare hosts; **local** uses the
`*-local` variants over HTTPS via nginx + mkcert. Local app ports avoid the
Angular default range (`42xx`) so they don't collide with other dev servers.

| Production              | Local                          | Proxies to        | Service                                   |
| ----------------------- | ------------------------------ | ----------------- | ----------------------------------------- |
| `auth.idnest.cloud`     | `auth-local.idnest.cloud`      | `127.0.0.1:4000`  | `auth-backend` (login/consent/logout/error) |
| `hydra.idnest.cloud`    | `hydra-local.idnest.cloud`     | `127.0.0.1:4444`  | Hydra public (authorize / token / OIDC)   |
| `kratos.idnest.cloud`   | `kratos-local.idnest.cloud`    | `127.0.0.1:4433`  | Kratos public (self-service, whoami)      |
| `admin.idnest.cloud`    | `admin-local.idnest.cloud`     | `127.0.0.1:4501` + `/api` to `:4100` | admin UI + confidential BFF |
| `api.daybook.cloud`     | `api-local.daybook.cloud`      | `127.0.0.1:3001`  | daybook product backend (OAuth resource server) |
| `app.daybook.cloud`     | `app-local.daybook.cloud`      | `127.0.0.1:4200`  | daybook product frontend (OAuth client)   |

Hydra admin (`:4445`) and Kratos admin (`:4434`) are **never** proxied to the
public internet — they stay on localhost / a private network.

## Step 1 — Prerequisites

- **Node** `>= 22` (the workspace pins `22.22.0` via `monorepo/.nvmrc`)
- **pnpm** `9.15.0` (provisioned by Corepack)
- **Docker** + **Docker Compose**
- **PostgreSQL** reachable from the containers (via `host.docker.internal`)
- **nginx** and **mkcert** (for local HTTPS on a Mac)

```bash
nvm use 22          # or: nvm install 22.22.0
corepack enable     # makes the pinned pnpm version available
```

## Step 2 — Checkout, install, build

```bash
git clone <this-repo> ory-auth-apps
cd ory-auth-apps/monorepo

pnpm install
pnpm build          # builds auth-backend, admin-backend, admin-frontend, shared-types
```

> All `pnpm` commands for the apps run from inside `monorepo/`.

## Step 3 — Local DNS (`/etc/hosts`)

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

## Step 4 — Local HTTPS certificate (Mac)

ORY cookies are `Secure` + `SameSite`, so the whole flow must run over HTTPS even
locally. One [`mkcert`](https://github.com/FiloSottile/mkcert) cert covers every
host:

```bash
brew install mkcert nss        # nss adds the local CA to Firefox
mkcert -install                # trust the local CA in the system keychain

sudo mkdir -p /opt/homebrew/etc/nginx/ssl
cd /opt/homebrew/etc/nginx/ssl

sudo mkcert -cert-file local.idnest.cloud.pem -key-file local.idnest.cloud-key.pem \
  auth-local.idnest.cloud \
  hydra-local.idnest.cloud \
  kratos-local.idnest.cloud \
  admin-local.idnest.cloud

sudo mkcert -cert-file local.daybook.cloud.pem -key-file local.daybook.cloud-key.pem \
  api-local.daybook.cloud \
  app-local.daybook.cloud
```

> `api-local` / `app-local` are your **daybook product** backend (`:3001`) and
> frontend — OAuth consumers, not part of the auth stack. They're included here
> so a single local cert + nginx covers the whole loop on one machine.

## Step 5 — nginx reverse proxy

Ready-made configs live in [`scripts/deploy/nginx/`](../scripts/deploy/nginx/).
Local configs are split by host under `local/`; production configs live under `prod/`.

Install the local one and reload:

```bash
sudo cp scripts/deploy/nginx/local/*.conf /opt/homebrew/etc/nginx/servers/
sudo nginx -t
sudo brew services restart nginx
```

Each block terminates TLS and forwards `X-Forwarded-Proto https`, which Hydra and
Kratos rely on to build correct `https://` URLs. For example, the `auth-backend`
block:

```nginx
server {
  listen 443 ssl;
  server_name auth-local.idnest.cloud;
  ssl_certificate     /opt/homebrew/etc/nginx/ssl/local.idnest.cloud.pem;
  ssl_certificate_key /opt/homebrew/etc/nginx/ssl/local.idnest.cloud-key.pem;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## Step 6 — Google and Apple OIDC credentials

Google:

1. Open `https://console.cloud.google.com/apis/credentials`.
2. **Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add the Kratos OIDC callback for each
   environment:
   - local: `https://kratos-local.idnest.cloud/self-service/methods/oidc/callback/google`
   - prod:  `https://kratos.idnest.cloud/self-service/methods/oidc/callback/google`
4. Copy the **Client ID** and **Client secret** into the infra `.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) in the next step.

Apple:

1. In Apple Developer, configure Sign in with Apple for the Services ID used by
   Kratos.
2. Add the Kratos OIDC callback for each environment:
   - local: `https://kratos-local.idnest.cloud/self-service/methods/oidc/callback/apple`
   - prod:  `https://kratos.idnest.cloud/self-service/methods/oidc/callback/apple`
3. Copy the **Services ID**, **Team ID**, **key ID**, and private key into the
   infra `.env` (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_PRIVATE_KEY_ID`,
   `APPLE_PRIVATE_KEY`) in the next step.

The callback path is fixed by Kratos: `self-service/methods/oidc/callback/<provider-id>`,
where the provider id is `google` or `apple` (see `config/kratos.tpl.yml`). The
Apple provider is rendered only when all Apple env vars are present, so
Google-only local setups can start without placeholder Apple credentials.

This self-hosted Kratos v25.4.0 config uses the default explicit linking flow.
Provider logins without a verified email are rejected before Hydra issues tokens.

## Step 7 — Environment files

Two env files, different consumers.

### 7a. Infra `.env` (repo root) — consumed by `scripts/docker/docker-compose.yml`

```ini
# App URLs
AUTH_URL=https://auth-local.idnest.cloud
CORS_ALLOWED_ORIGINS=https://admin-local.idnest.cloud,https://app-local.daybook.cloud

# Hydra
HYDRA_ADMIN_URL=http://localhost:4445
HYDRA_DB_USER=hydrau
HYDRA_DB_NAME=hydra
HYDRA_DB_SCHEMA=hydra
HYDRA_DB_PASSWORD=<hydra_db_password>
HYDRA_DSN=postgres://hydrau:<hydra_db_password>@host.docker.internal:5432/hydra?sslmode=disable
HYDRA_URLS_SELF_ISSUER=https://hydra-local.idnest.cloud/
HYDRA_URLS_LOGIN=https://auth-local.idnest.cloud/login
HYDRA_URLS_CONSENT=https://auth-local.idnest.cloud/consent
HYDRA_URLS_LOGOUT=https://auth-local.idnest.cloud/logout
HYDRA_URLS_ERROR=https://auth-local.idnest.cloud/error
HYDRA_SECRETS_SYSTEM=<random_32+_char_secret>

# Kratos
KRATOS_DB_USER=kratosu
KRATOS_DB_NAME=kratos
KRATOS_DB_SCHEMA=kratos
KRATOS_DB_PASSWORD=<kratos_db_password>
KRATOS_DSN=postgres://kratosu:<kratos_db_password>@host.docker.internal:5432/kratos?sslmode=disable
KRATOS_SERVE_PUBLIC_BASE_URL=https://kratos-local.idnest.cloud
KRATOS_ADMIN_URL=http://localhost:4434
KRATOS_URLS_LOGOUT=https://hydra-local.idnest.cloud/logout
KRATOS_COOKIES_DOMAIN=.idnest.cloud
KRATOS_LOG_LEVEL=info
KRATOS_CSRF_COOKIE_SECRET=<random_32+_char_secret>
KRATOS_CIPHER_SECRET=<exactly_32_char_secret>

# Authz
AUTHZ_DB_USER=authzu
AUTHZ_DB_NAME=authz
AUTHZ_DB_SCHEMA=authz
AUTHZ_DB_PASSWORD=<authz_db_password>

# Social OIDC (from Step 6)
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>

# Optional: include all Apple values to render the Apple provider
APPLE_CLIENT_ID=<apple_services_id>
APPLE_TEAM_ID=<apple_team_id>
APPLE_PRIVATE_KEY_ID=<apple_private_key_id>
APPLE_PRIVATE_KEY="<pem_with_\n_escapes>"
```

> `CORS_ALLOWED_ORIGINS` (infra) is what Hydra and Kratos allow as browser
> origins — include every product app origin (so the app can call Hydra's token
> endpoint) plus the admin console. For prod, swap in `https://app.daybook.cloud`
> and `https://admin.idnest.cloud`.

### 7b. Apps `monorepo/.env` (from `monorepo/.env.example`) — consumed by the backends

```bash
cd monorepo
cp .env.example .env
```

```ini
HYDRA_ADMIN_URL=http://localhost:4445
KRATOS_ADMIN_URL=http://localhost:4434

# Browser-reachable Kratos origin: auth-backend redirects the browser here and
# forwards the session cookie to it. Use the public host, not a docker name.
KRATOS_PUBLIC_URL=https://kratos-local.idnest.cloud

# auth-backend's own public origin. MUST equal the AUTH_URL origin in Kratos
# `allowed_return_urls`, or Kratos rejects the post-login return.
AUTH_BASE_URL=https://auth-local.idnest.cloud

AUTH_BACKEND_PORT=4000
ADMIN_BACKEND_PORT=4100
ADMIN_CORS_ALLOWED_ORIGINS=https://admin-local.idnest.cloud
ADMIN_CSRF_SECRET=<random_32+_char_secret>
ADMIN_PUBLIC_ORIGIN=https://admin-local.idnest.cloud
ADMIN_BOOTSTRAP_IDENTITY_IDS=<kratos_identity_id>
ADMIN_OIDC_CLIENT_ID=idnest-admin-client
ADMIN_OIDC_CLIENT_SECRET=<random_admin_client_secret>
ADMIN_OIDC_AUTHORITY=https://hydra-local.idnest.cloud/
ADMIN_OIDC_REDIRECT_URI=https://admin-local.idnest.cloud/api/admin/auth/callback
ADMIN_OIDC_SCOPE="openid profile email"
ADMIN_OIDC_AUDIENCE=idnest-admin
ADMIN_API_BASE_URL=/api
```

**Key wiring at a glance**

| Variable                 | Where     | Drives                                                  |
| ------------------------ | --------- | ------------------------------------------------------- |
| `AUTH_URL`               | infra     | Hydra login/consent/logout/error URLs + Kratos ui_url   |
| `AUTH_BASE_URL`          | apps      | Kratos `return_to` after login (`/login/return`)        |
| `KRATOS_PUBLIC_URL`      | apps      | browser login redirect + Kratos public API operations   |
| `KRATOS_SERVE_PUBLIC_BASE_URL` | infra | the public URL Kratos puts in flow `ui.action`        |
| `KRATOS_COOKIES_DOMAIN`  | infra     | SSO cookie scope (`.idnest.cloud`)                      |

## Step 8 — Create databases

For a new local setup, run the one-shot bootstrap from the repo root after
filling both env files:

```bash
./scripts/bootstrap-local.sh
```

Or run the OS-specific helper in `scripts/setup/` (creates roles, databases,
dedicated schemas and runs ORY migrations):

```bash
# macOS
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./scripts/setup/setup-ory-macos.sh
# Linux
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... ./scripts/setup/setup-ory-linux.sh
```

…or do it manually as a superuser:

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

## Step 9 — Run database migrations

(Skip ORY migrations if `scripts/setup/setup-ory-*.sh` already did this.)

```bash
# Hydra
docker run --rm --network host \
  -e DSN='postgres://hydrau:<password>@127.0.0.1:5432/hydra?sslmode=disable' \
  oryd/hydra:v26.2.0 migrate sql up -e --yes

# Kratos
docker run --rm --network host \
  -e DSN='postgres://kratosu:<password>@127.0.0.1:5432/kratos?sslmode=disable' \
  -v "$PWD/config:/etc/config" \
  oryd/kratos:v25.4.0 migrate sql -e --yes

# Authz
cd monorepo
AUTHZ_DATABASE_URL='postgres://authzu:<password>@127.0.0.1:5432/authz?sslmode=disable' pnpm authz:migrate
```

## Step 10 — Start Hydra + Kratos

```bash
docker compose -f scripts/docker/docker-compose.yml up -d
docker compose -f scripts/docker/docker-compose.yml logs -f ory-kratos
```

The Kratos container renders `config/kratos.yml` from `kratos.tpl.yml` via
`envsubst` at startup, so re-run `docker compose -f scripts/docker/docker-compose.yml up -d --force-recreate
ory-kratos` after editing the template or env. Verify Kratos:

```bash
curl -k https://kratos-local.idnest.cloud/health/ready
```

## Step 11 — Start the backends

```bash
cd monorepo
pnpm auth-backend:serve     # Express + server-rendered pages on :4000
pnpm admin-backend:serve    # admin API on :4100 (optional)
pnpm admin-frontend:serve   # Angular console on :4501 (optional)
```

Health check: `curl http://localhost:4000/health`. Opening
`https://auth-local.idnest.cloud/login` directly redirects into the Kratos flow
(a real `login_challenge` only arrives via a product app's OAuth redirect,
Step 12).

## Step 12 — Register the admin Hydra OAuth client

The bootstrap creates only the protected Idnest admin client:

```bash
cd monorepo
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:admin-client
```

Product OAuth clients should be created and managed from the admin console. Public
browser SPAs should use `token_endpoint_auth_method=none` and PKCE, with app-specific
`redirect_uris`, `post_logout_redirect_uris`, and `audience`.

## Step 13 — Verify the flow

Trigger a login from a product app (or build an authorize URL by hand, below).
You should land on `auth-local.idnest.cloud/login`, sign in with Google, and be
redirected back to the app with an authorization code.

---

# Client app integration (example)

A product SPA on `app.daybook.cloud` uses Hydra as its OpenID Provider with the
Authorization Code + PKCE flow. It redirects to `auth.idnest.cloud` to sign in.

### 1. Register the client in the admin portal

```json
{
  "client_id": "daybook-user-client",
  "client_name": "Daybook User Client",
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

OIDC discovery is served at `https://hydra.idnest.cloud/.well-known/openid-configuration`
(local: `https://hydra-local.idnest.cloud/...`).

### 2. Client config (using [`oidc-client-ts`](https://github.com/authts/oidc-client-ts))

```ts
// auth.ts — product SPA
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://hydra.idnest.cloud/",               // = HYDRA_URLS_SELF_ISSUER
  client_id: "daybook-user-client",
  redirect_uri: "https://app.daybook.cloud/auth/callback",
  post_logout_redirect_uri: "https://app.daybook.cloud/auth/logout",
  response_type: "code",                                  // Authorization Code + PKCE
  scope: "openid profile email offline_access",
  // Hydra issues audience-scoped tokens; request this app's audience:
  extraQueryParams: { audience: "daybook.cloud-users" },
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// Start login:        userManager.signinRedirect();
// On /auth/callback:  await userManager.signinRedirectCallback();
// Logout:             userManager.signoutRedirect();
```

PKCE is generated automatically for public clients — no client secret is ever
shipped to the browser. The browser only ever talks to `hydra.idnest.cloud`
(authorize, token) and `auth.idnest.cloud` (login UI); it never sees Kratos/Hydra
admin URLs.

### 3. Equivalent raw authorize URL (for reference / non-JS clients)

```
https://hydra.idnest.cloud/oauth2/auth
  ?client_id=daybook-user-client
  &response_type=code
  &scope=openid%20profile%20email%20offline_access
  &redirect_uri=https%3A%2F%2Fapp.daybook.cloud%2Fauth%2Fcallback
  &audience=daybook.cloud-users
  &state=<random>
  &code_challenge=<base64url-sha256(verifier)>
  &code_challenge_method=S256
```

The app exchanges the returned `code` (plus the PKCE `code_verifier`) at
`https://hydra.idnest.cloud/oauth2/token` for `id_token` / `access_token` /
`refresh_token`.

---

## Auth flow (server-rendered)

1. A product app sends the user to Hydra's authorize endpoint (`hydra.idnest.cloud`).
2. Hydra redirects to `auth-backend`'s **`/login`** route (`auth.idnest.cloud`) with a `login_challenge`.
3. `/login` starts the Kratos browser login flow; Kratos bounces back to
   `/login?flow=…`, which server-side reads the `csrf_token` and renders the
   provider buttons (full-page form POSTs to Kratos → selected OIDC provider).
4. After the selected provider returns, Kratos redirects to **`/login/return`**, which resolves
   the session server-side (Kratos `whoami`, forwarding the cookie — no browser
   polling) and calls Hydra **accept-login**.
5. Hydra redirects to **`/consent`**, which calls Hydra **accept-consent**,
   granting exactly the requested scope/audience.
6. Hydra issues tokens and redirects back to the product app.
7. **`/logout`** terminates the Kratos session (relaying the cookie-clearing
   `Set-Cookie`) and then accepts the Hydra logout challenge.

---

## Develop, test, lint

```bash
pnpm test                          # vitest across all projects
pnpm exec nx test auth-backend     # a single project
pnpm lint                          # eslint across all projects
pnpm exec nx lint auth-backend --fix
pnpm typecheck                     # tsc --noEmit across all projects
pnpm build                         # build every project
```

---

## Production deployment notes

- Use the bare `*.idnest.cloud` hosts for auth/Hydra/Kratos/admin. Set `AUTH_URL`,
  `AUTH_BASE_URL`, `KRATOS_SERVE_PUBLIC_BASE_URL`, and `KRATOS_PUBLIC_URL` accordingly;
  `AUTH_URL` and `AUTH_BASE_URL` must share the same origin (`auth.idnest.cloud`).
- Front everything with [`scripts/deploy/nginx/prod/`](../scripts/deploy/nginx/prod/)
  (wildcard `*.idnest.cloud` cert for auth/admin, `*.daybook.cloud` cert for product apps).
- Build from `monorepo/` with `pnpm build`, then run the backend bundles with PM2:
  `pm2 start dist/apps/auth-backend/main.cjs --name idnest-auth-backend --cwd "$PWD"`
  and `pm2 start dist/apps/admin-backend/main.cjs --name idnest-admin-backend --cwd "$PWD"`.
- Serve the `admin-frontend` build as static files.
- Keep Hydra admin (`:4445`) and Kratos admin (`:4434`) on a private network —
  never expose them publicly.
- Use managed/persistent PostgreSQL and inject all secrets from a secret manager.

---

## Debug

```bash
# List / delete identities (Kratos admin API)
curl -s http://localhost:4434/admin/identities | jq .
curl -X DELETE http://localhost:4434/admin/identities/<identity-id>

# Inspect the rendered Kratos config inside the container
docker exec -it ory-kratos cat /etc/config/kratos.yml

# Recreate the stack
docker compose -f scripts/docker/docker-compose.yml down --remove-orphans
docker compose -f scripts/docker/docker-compose.yml up -d
docker logs ory-kratos
```

---

## Security notes

- **Social account linking**: this self-hosted Kratos v25.4.0 config uses the
  default explicit linking flow from `/settings`. Provider logins without a
  verified email are rejected before Hydra issues tokens.
- **Rotate secrets**: the Google client secret, `HYDRA_SECRETS_SYSTEM`, both DB
  passwords, and the Kratos cookie/cipher secrets were present in the working
  tree historically and must be considered compromised — rotate them and move to
  a secret manager / env injection for deploys (see `MIGRATION_PLAN.md` §1.2).
- No local credentials are stored; only federated identities.
- The Hydra/Kratos **admin** URLs are read server-side only and are never
  shipped to the browser.
- For production: enforce HTTPS everywhere, use persistent databases, and keep
  admin APIs (`:4434`, `:4445`) off the public internet.
