# idnest.dev Auth (ORY Hydra + Kratos)

Authentication and authorization built on the **ORY** ecosystem. Identity is
**Google OIDC only** (no local username/password). The public login / consent /
logout / error pages are **server-rendered by the `auth-backend` Express
service** (the former Angular `auth-frontend` SPA was removed); a separate
Angular admin console remains.

**Domain model**

- **`idnest.dev`** hosts the auth deployment itself — the identity provider
  (`auth.idnest.dev`), Hydra, Kratos, the admin API, and the admin console. The
  SSO session cookie is scoped to `.idnest.dev`, so all of these share one login.
- **`daybook.cloud`** (and any other product) is a **consumer**: each app is its
  own Hydra OAuth client that redirects to `auth.idnest.dev` to sign in and
  receives tokens. Product apps don't share the session cookie — they don't need
  to; OAuth gives them tokens.

See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for the full migration history.

---

## Architecture

| Component             | Tech                       | Role                                                              |
| --------------------- | -------------------------- | ----------------------------------------------------------------- |
| ORY Hydra `v2.3.0`    | Docker image               | OAuth2 / OpenID Connect server: issues tokens, owns login/consent/logout challenges |
| ORY Kratos `v1.3.1`   | Docker image               | Identity provider: runs the Google OIDC login flow, stores identities, sessions |
| `auth-backend`        | TypeScript + Express       | Hydra/Kratos **admin** proxy **and** server-rendered login/consent/logout/error pages (admin URLs stay server-side) |
| `admin-backend`       | TypeScript + Express       | Privileged admin API (identities, clients, roles)                 |
| `admin-frontend`      | Angular 21 + TailNG        | Staff-only admin console                                          |
| `shared-types`        | TypeScript library         | Shared Kratos/Hydra interfaces + runtime guards                   |
| PostgreSQL            | external                   | Separate `hydra` and `kratos` databases                           |

The apps live in [`monorepo/`](monorepo/). Hydra + Kratos run as Docker images
orchestrated by [`docker-compose.yml`](docker-compose.yml).

### Repository layout

```
.
├── config/                  # Kratos config (kratos.tpl.yml -> kratos.yml via envsubst)
│   └── kratos/               # identity schema + Google OIDC claims mapper
├── Dockerfile.kratos        # Kratos image that renders the template at startup
├── docker-compose.yml       # Hydra + Kratos services
├── .env                      # Infra secrets/DSNs consumed by docker-compose (gitignored)
├── setup-ory.sh             # DB bootstrap + migrations helper
├── deploy/nginx/            # nginx reverse-proxy configs (idnest-local.conf, idnest-prod.conf)
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
    ├── tools/               # create-hydra-clients.mjs + apps.config.json
    └── .env.example         # App config (copy to monorepo/.env)
```

---

# Setup — step by step

Hostnames and ports used throughout. **Production** uses the bare hosts;
**local** uses the `*-local` variants over HTTPS via nginx + mkcert.

| Production            | Local                       | Proxies to        | Service                                   |
| --------------------- | --------------------------- | ----------------- | ----------------------------------------- |
| `auth.idnest.dev`     | `auth-local.idnest.dev`     | `127.0.0.1:4000`  | `auth-backend` (login/consent/logout/error) |
| `hydra.idnest.dev`    | `hydra-local.idnest.dev`    | `127.0.0.1:4444`  | Hydra public (authorize / token / OIDC)   |
| `kratos.idnest.dev`   | `kratos-local.idnest.dev`   | `127.0.0.1:4433`  | Kratos public (self-service, whoami)      |
| `api.idnest.dev`      | `api-local.idnest.dev`      | `127.0.0.1:4100`  | `admin-backend` API                       |
| `admin.idnest.dev`    | `admin-local.idnest.dev`    | `127.0.0.1:4201`  | `admin-frontend` console                  |
| `app.daybook.cloud`   | `app-local.daybook.cloud`   | the app's server  | a product/client app (OAuth client)       |

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
127.0.0.1 auth-local.idnest.dev hydra-local.idnest.dev kratos-local.idnest.dev api-local.idnest.dev admin-local.idnest.dev
127.0.0.1 app-local.daybook.cloud
EOF
```

## Step 4 — Local HTTPS certificate (Mac)

ORY cookies are `Secure` + `SameSite`, so the whole flow must run over HTTPS even
locally. One [`mkcert`](https://github.com/FiloSottile/mkcert) cert covers every
host (the auth hosts on `idnest.dev` plus the product app on `daybook.cloud`):

```bash
brew install mkcert nss        # nss adds the local CA to Firefox
mkcert -install                # trust the local CA in the system keychain

sudo mkdir -p /opt/homebrew/etc/nginx/ssl
cd /opt/homebrew/etc/nginx/ssl

sudo mkcert -cert-file idnest-local.pem -key-file idnest-local-key.pem \
  auth-local.idnest.dev \
  hydra-local.idnest.dev \
  kratos-local.idnest.dev \
  api-local.idnest.dev \
  admin-local.idnest.dev \
  app-local.daybook.cloud
```

## Step 5 — nginx reverse proxy

Ready-made configs live in [`deploy/nginx/`](deploy/nginx/):

- [`idnest-local.conf`](deploy/nginx/idnest-local.conf) — local HTTPS with the
  mkcert cert from Step 4.
- [`idnest-prod.conf`](deploy/nginx/idnest-prod.conf) — production, assuming a
  wildcard `*.idnest.dev` cert.

Install the local one and reload:

```bash
sudo cp deploy/nginx/idnest-local.conf /opt/homebrew/etc/nginx/servers/
sudo nginx -t
sudo brew services restart nginx
```

Each block terminates TLS and forwards `X-Forwarded-Proto https`, which Hydra and
Kratos rely on to build correct `https://` URLs. For example, the `auth-backend`
block:

```nginx
server {
  listen 443 ssl;
  server_name auth-local.idnest.dev;
  ssl_certificate     /opt/homebrew/etc/nginx/ssl/idnest-local.pem;
  ssl_certificate_key /opt/homebrew/etc/nginx/ssl/idnest-local-key.pem;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## Step 6 — Google OIDC credentials

1. Open `https://console.cloud.google.com/apis/credentials`.
2. **Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add the Kratos OIDC callback for each
   environment:
   - local: `https://kratos-local.idnest.dev/self-service/methods/oidc/callback/google`
   - prod:  `https://kratos.idnest.dev/self-service/methods/oidc/callback/google`
4. Copy the **Client ID** and **Client secret** into the infra `.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) in the next step.

The callback path is fixed by Kratos: `self-service/methods/oidc/callback/<provider-id>`,
where the provider id is `google` (see `config/kratos.tpl.yml`).

## Step 7 — Environment files

Two env files, different consumers.

### 7a. Infra `.env` (repo root) — consumed by `docker-compose.yml`

```ini
# App URLs
AUTH_URL=https://auth-local.idnest.dev
CORS_ALLOWED_ORIGINS=https://admin-local.idnest.dev,https://app-local.daybook.cloud

# Hydra
HYDRA_ADMIN_URL=http://localhost:4445
HYDRA_DSN=postgres://hydrau:<hydra_db_password>@host.docker.internal:5432/hydra?sslmode=disable
HYDRA_URLS_SELF_ISSUER=https://hydra-local.idnest.dev/
HYDRA_URLS_LOGIN=https://auth-local.idnest.dev/login
HYDRA_URLS_CONSENT=https://auth-local.idnest.dev/consent
HYDRA_URLS_LOGOUT=https://auth-local.idnest.dev/logout
HYDRA_URLS_ERROR=https://auth-local.idnest.dev/error
HYDRA_SECRETS_SYSTEM=<random_32+_char_secret>

# Kratos
KRATOS_DSN=postgres://kratosu:<kratos_db_password>@host.docker.internal:5432/kratos?sslmode=disable
KRATOS_SERVE_PUBLIC_BASE_URL=https://kratos-local.idnest.dev
KRATOS_ADMIN_URL=http://localhost:4434
KRATOS_URLS_LOGOUT=https://hydra-local.idnest.dev/logout
KRATOS_COOKIES_DOMAIN=.idnest.dev
KRATOS_LOG_LEVEL=info
KRATOS_CSRF_COOKIE_SECRET=<random_32+_char_secret>
KRATOS_CIPHER_SECRET=<exactly_32_char_secret>

# Google OIDC (from Step 6)
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>
```

> `CORS_ALLOWED_ORIGINS` (infra) is what Hydra and Kratos allow as browser
> origins — include every product app origin (so the app can call Hydra's token
> endpoint) plus the admin console. For prod, swap in `https://app.daybook.cloud`
> and `https://admin.idnest.dev`.

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
KRATOS_PUBLIC_URL=https://kratos-local.idnest.dev

# auth-backend's own public origin. MUST equal the AUTH_URL origin in Kratos
# `allowed_return_urls`, or Kratos rejects the post-login return.
AUTH_BASE_URL=https://auth-local.idnest.dev

AUTH_BACKEND_PORT=4000
ADMIN_BACKEND_PORT=4100
CORS_ALLOWED_ORIGINS=https://admin-local.idnest.dev,https://app-local.daybook.cloud
ADMIN_BOOTSTRAP_EMAILS=you@example.com
```

**Key wiring at a glance**

| Variable                 | Where     | Drives                                                  |
| ------------------------ | --------- | ------------------------------------------------------- |
| `AUTH_URL`               | infra     | Hydra login/consent/logout/error URLs + Kratos ui_url   |
| `AUTH_BASE_URL`          | apps      | Kratos `return_to` after login (`/login/return`)        |
| `KRATOS_PUBLIC_URL`      | apps      | browser login redirect + server-side whoami/logout      |
| `KRATOS_SERVE_PUBLIC_BASE_URL` | infra | the public URL Kratos puts in flow `ui.action`        |
| `KRATOS_COOKIES_DOMAIN`  | infra     | SSO cookie scope (`.idnest.dev`)                        |

## Step 8 — Create databases

Either run the helper (creates roles + databases and runs migrations):

```bash
HYDRA_DB_PASSWORD=... KRATOS_DB_PASSWORD=... KRATOS_CONFIG_DIR="$PWD/config" \
  ./setup-ory.sh
```

…or do it manually as a superuser:

```sql
CREATE USER hydrau  WITH PASSWORD '<hydra_db_password>';
CREATE DATABASE hydra OWNER hydrau;

CREATE USER kratosu WITH PASSWORD '<kratos_db_password>';
CREATE DATABASE kratos OWNER kratosu;
```

## Step 9 — Run database migrations

(Skip if `setup-ory.sh` already did this.)

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

## Step 10 — Start Hydra + Kratos

```bash
docker compose up -d
docker compose logs -f ory-kratos
```

The Kratos container renders `config/kratos.yml` from `kratos.tpl.yml` via
`envsubst` at startup, so re-run `docker compose up -d --force-recreate
ory-kratos` after editing the template or env. Verify Kratos:

```bash
curl -k https://kratos-local.idnest.dev/health/ready
```

## Step 11 — Start the backends

```bash
cd monorepo
pnpm auth-backend:serve     # Express + server-rendered pages on :4000
pnpm admin-backend:serve    # admin API on :4100 (optional)
pnpm admin-frontend:serve   # Angular console on :4201 (optional)
```

Health check: `curl http://localhost:4000/health`. Opening
`https://auth-local.idnest.dev/login` directly redirects into the Kratos flow (a
real `login_challenge` only arrives via a product app's OAuth redirect, Step 12).

## Step 12 — Register Hydra OAuth clients (one per app)

Each product app authenticates through its own Hydra client. Define apps in
[`monorepo/tools/apps.config.json`](monorepo/tools/apps.config.json), then
register/refresh them:

```bash
cd monorepo
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:clients
```

`public: true` marks browser SPAs — created with
`token_endpoint_auth_method=none`, which makes Hydra **require PKCE**. Each app
gets its own `redirect_uris`, `post_logout_redirect_uris`, and `audience` so
tokens stay scoped and audience-isolated.

## Step 13 — Verify the flow

Trigger a login from a product app (or build an authorize URL by hand, below).
You should land on `auth-local.idnest.dev/login`, sign in with Google, and be
redirected back to the app with an authorization code.

---

# Client app integration (example)

A product SPA (e.g. on `daybook.cloud`) uses Hydra as its OpenID Provider with
the Authorization Code + PKCE flow. It redirects to `auth.idnest.dev` to sign in.

### 1. Register the client (`monorepo/tools/apps.config.json`)

```json
{
  "apps": [
    {
      "client_id": "dev.daybook.cloud-user-client",
      "client_name": "Daybook User Client",
      "public": true,
      "scope": "openid profile email offline_access",
      "redirect_uris": ["https://app.daybook.cloud/auth/callback"],
      "post_logout_redirect_uris": ["https://app.daybook.cloud/auth/logout"],
      "audience": ["daybook.cloud-users"]
    }
  ]
}
```

Then run `pnpm hydra:clients` (Step 12). OIDC discovery is served at
`https://hydra.idnest.dev/.well-known/openid-configuration` (local:
`https://hydra-local.idnest.dev/...`).

### 2. Client config (using [`oidc-client-ts`](https://github.com/authts/oidc-client-ts))

```ts
// auth.ts — product SPA
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://hydra.idnest.dev/",                 // = HYDRA_URLS_SELF_ISSUER
  client_id: "dev.daybook.cloud-user-client",
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
shipped to the browser. The browser only ever talks to `hydra.idnest.dev`
(authorize, token) and `auth.idnest.dev` (login UI); it never sees Kratos/Hydra
admin URLs.

### 3. Equivalent raw authorize URL (for reference / non-JS clients)

```
https://hydra.idnest.dev/oauth2/auth
  ?client_id=dev.daybook.cloud-user-client
  &response_type=code
  &scope=openid%20profile%20email%20offline_access
  &redirect_uri=https%3A%2F%2Fapp.daybook.cloud%2Fauth%2Fcallback
  &audience=daybook.cloud-users
  &state=<random>
  &code_challenge=<base64url-sha256(verifier)>
  &code_challenge_method=S256
```

The app exchanges the returned `code` (plus the PKCE `code_verifier`) at
`https://hydra.idnest.dev/oauth2/token` for `id_token` / `access_token` /
`refresh_token`.

---

## Auth flow (server-rendered)

1. A product app sends the user to Hydra's authorize endpoint (`hydra.idnest.dev`).
2. Hydra redirects to `auth-backend`'s **`/login`** route (`auth.idnest.dev`) with a `login_challenge`.
3. `/login` starts the Kratos browser login flow; Kratos bounces back to
   `/login?flow=…`, which server-side reads the `csrf_token` and renders the
   "Sign in with Google" button (a full-page form POST to Kratos → Google OIDC).
4. After Google returns, Kratos redirects to **`/login/return`**, which resolves
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

- Use the bare `*.idnest.dev` hosts. Set `AUTH_URL`, `AUTH_BASE_URL`,
  `KRATOS_SERVE_PUBLIC_BASE_URL`, and `KRATOS_PUBLIC_URL` accordingly;
  `AUTH_URL` and `AUTH_BASE_URL` must share the same origin (`auth.idnest.dev`).
- Front everything with [`deploy/nginx/idnest-prod.conf`](deploy/nginx/idnest-prod.conf)
  (wildcard `*.idnest.dev` cert); build the backends (`pnpm build`) and run the
  bundle (`node dist/apps/auth-backend/main.cjs`); serve the `admin-frontend`
  build as static files.
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
  tree historically and must be considered compromised — rotate them and move to
  a secret manager / env injection for deploys (see `MIGRATION_PLAN.md` §1.2).
- No local credentials are stored; only federated identities.
- The Hydra/Kratos **admin** URLs are read server-side only and are never
  shipped to the browser.
- For production: enforce HTTPS everywhere, use persistent databases, and keep
  admin APIs (`:4434`, `:4445`) off the public internet.
