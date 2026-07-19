# Idnest Auth — Ory Hydra + Kratos

This repository contains the Idnest authentication platform used by
`daybook.cloud`. It combines Ory Hydra, Ory Kratos, PostgreSQL, two Express
backends, and an Angular administration console.

This is the authoritative setup and operations guide for the entire repository,
including the Nx workspace under `monorepo/`.

## 1. Architecture

| Component | Local URL | Direct port | Purpose |
| --- | --- | ---: | --- |
| Auth backend | `https://auth-local.idnest.cloud` | `4000` | Server-rendered login, consent, logout, settings, and error pages |
| Hydra public | `https://hydra-local.idnest.cloud` | `4444` | OAuth 2.0 and OpenID Connect endpoints |
| Hydra admin | Server-side only | `4445` | Privileged Hydra API |
| Kratos public | `https://kratos-local.idnest.cloud` | `4433` | Identity self-service and session endpoints |
| Kratos admin | Server-side only | `4434` | Privileged identity API |
| Admin backend | `https://admin-local.idnest.cloud/api` | `4100` | Confidential BFF and administration API |
| Admin frontend | `https://admin-local.idnest.cloud` | `4501` | Angular administration console |

The browser reaches the public services through nginx and locally trusted HTTPS.
Hydra/Kratos admin endpoints remain bound to localhost and are used only by the
backends.

Repository layout:

```text
.
├── config/                    # Kratos templates, schemas, and OIDC mappers
├── scripts/
│   ├── bootstrap-local.sh     # One-shot database + Ory bootstrap
│   ├── deploy/                # nginx and deployment files
│   ├── docker/                # Hydra/Kratos Compose stack
│   └── setup/                 # Shared env loader and OS setup scripts
├── monorepo/
│   ├── apps/auth-backend/     # Express auth UI/backend
│   ├── apps/admin-backend/    # Express admin BFF/API
│   ├── apps/admin-frontend/   # Angular admin console
│   └── libs/                  # Shared types and authorization store
├── .env.example               # Infrastructure env template
└── monorepo/.env.example      # Application env template
```

## 2. Fresh installation

Complete the shared steps and then the operating-system block for your machine.

### 2.1 Shared prerequisites

- Git
- Node.js `22.22.0` (the version in `monorepo/.nvmrc`)
- pnpm `9.15.0` through Corepack
- PostgreSQL
- Docker with the Compose plugin
- nginx
- [`mkcert`](https://github.com/FiloSottile/mkcert) for locally trusted HTTPS

Use the official installation documentation for
[Node.js 22](https://nodejs.org/en/download/archive/v22) and
[Docker](https://docs.docker.com/engine/install/) when they are not already
installed.

Verify the toolchain:

```bash
node --version
pnpm --version
psql --version
docker --version
docker compose version
nginx -v
mkcert --version
```

### 2.2 macOS prerequisites

Install Homebrew packages:

```bash
brew install git nginx mkcert nss postgresql@16
brew services start postgresql@16
brew services start nginx

export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
```

Install and start Docker Desktop if it is not already available. Then verify
that `docker info` succeeds.

Install Node with your preferred version manager. With `nvm`:

```bash
cd monorepo
nvm install
nvm use
corepack enable
corepack prepare pnpm@9.15.0 --activate
cd ..
```

### 2.3 Linux prerequisites

The commands below target Ubuntu/Debian. Use the equivalent packages on other
distributions.

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-client libnss3-tools
sudo systemctl enable --now postgresql nginx
```

Install Docker Engine and its Compose plugin using the
[official distribution instructions](https://docs.docker.com/engine/install/).
If Docker is configured for non-root use, verify that `docker info` succeeds as
your normal user.

Install `mkcert`. For Linux amd64, the upstream project provides this installer:

```bash
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo install -m 0755 mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

Use the matching upstream binary for arm64 or another architecture.

Install Node `22.22.0` with your preferred version manager, then enable the
pinned pnpm version:

```bash
cd monorepo
nvm install
nvm use
corepack enable
corepack prepare pnpm@9.15.0 --activate
cd ..
```

### 2.4 Install repository dependencies

From the repository root:

```bash
cd monorepo
pnpm install
pnpm build
cd ..
```

### 2.5 Configure local DNS

Add the Idnest development hosts to `/etc/hosts`:

```text
127.0.0.1 auth-local.idnest.cloud
127.0.0.1 hydra-local.idnest.cloud
127.0.0.1 kratos-local.idnest.cloud
127.0.0.1 admin-local.idnest.cloud
```

If the Daybook product frontend/API also run on this machine, add their local
hosts from the Daybook repository as well.

### 2.6 Configure local HTTPS and nginx

Install the local certificate authority once:

```bash
mkcert -install
```

#### macOS nginx block

Homebrew may be installed under `/opt/homebrew` or `/usr/local`; the commands
below adapt the checked-in nginx files to the active prefix.

```bash
NGINX_PREFIX="$(brew --prefix)"
SSL_DIR="$NGINX_PREFIX/etc/nginx/ssl"
SERVER_DIR="$NGINX_PREFIX/etc/nginx/servers"

mkdir -p "$SSL_DIR" "$SERVER_DIR"
mkcert \
  -cert-file "$SSL_DIR/local.idnest.cloud.pem" \
  -key-file "$SSL_DIR/local.idnest.cloud-key.pem" \
  "*.idnest.cloud" idnest.cloud
chmod 600 "$SSL_DIR/local.idnest.cloud-key.pem"

for source in scripts/deploy/nginx/local/*.conf; do
  destination="$SERVER_DIR/$(basename "$source")"
  sed "s#/opt/homebrew#$NGINX_PREFIX#g" "$source" > "$destination"
done

nginx -t
brew services restart nginx
```

#### Linux nginx block

The checked-in local nginx files use the Homebrew certificate path. Generate
Linux copies with `/etc/nginx/ssl` instead:

```bash
cert_dir="$(mktemp -d)"
mkcert \
  -cert-file "$cert_dir/local.idnest.cloud.pem" \
  -key-file "$cert_dir/local.idnest.cloud-key.pem" \
  "*.idnest.cloud" idnest.cloud

sudo install -d -m 0755 /etc/nginx/ssl
sudo install -m 0644 "$cert_dir/local.idnest.cloud.pem" /etc/nginx/ssl/
sudo install -m 0600 "$cert_dir/local.idnest.cloud-key.pem" /etc/nginx/ssl/

for source in scripts/deploy/nginx/local/*.conf; do
  destination="/etc/nginx/conf.d/$(basename "$source")"
  sed 's#/opt/homebrew/etc/nginx/ssl#/etc/nginx/ssl#g' "$source" \
    | sudo tee "$destination" >/dev/null
done

sudo nginx -t
sudo systemctl restart nginx
```

### 2.7 Configure Google and optional Apple login

Create a Google OAuth web application and register this redirect URI:

```text
https://kratos-local.idnest.cloud/self-service/methods/oidc/callback/google
```

Put the Google client ID and secret in the root `.env`. For production, add the
equivalent `https://kratos.idnest.cloud/.../google` redirect.

Apple login is optional. It is rendered only when all four `APPLE_*` values are
present. Its local callback is:

```text
https://kratos-local.idnest.cloud/self-service/methods/oidc/callback/apple
```

### 2.8 Create and fill both env files

```bash
cp .env.example .env
cp monorepo/.env.example monorepo/.env
```

The files have separate responsibilities:

- `./.env` contains Hydra/Kratos infrastructure configuration and social OIDC
  credentials. Docker Compose and Kratos config rendering consume it.
- `monorepo/.env` contains backend URLs, Authz configuration, admin BFF
  secrets, the first-admin email allowlist, and browser runtime configuration.

Generate independent development secrets rather than reusing one value:

```bash
openssl rand -hex 32   # long secret: Hydra, CSRF, consent, admin client
openssl rand -hex 16   # exactly 32 characters: KRATOS_CIPHER_SECRET
```

Important database rules:

- `HYDRA_DSN` is the Hydra database source of truth.
- `KRATOS_DSN` is the Kratos database source of truth.
- `AUTHZ_DATABASE_URL` in `monorepo/.env` is the Authz database source of truth.
- The setup scripts derive each database user, password, database name, and
  default schema from these URLs. Do not add separate `*_DB_USER`,
  `*_DB_PASSWORD`, `*_DB_NAME`, or `*_DB_SCHEMA` entries.
- Use URL-safe passwords or percent-encode reserved URL characters.

Set `ADMIN_BOOTSTRAP_EMAILS` to a comma-separated allowlist containing the
verified Google/Apple email permitted to become the first administrator:

```dotenv
ADMIN_BOOTSTRAP_EMAILS=admin@example.com
```

When there are zero active system administrators, the first verified login
matching this list receives the initial `system-admin` grant atomically. Once an
administrator exists, the allowlist cannot grant additional administrators.

`AUTH_URL` in the root file and `AUTH_BASE_URL` in the monorepo file must use
the same origin. `KRATOS_PUBLIC_URL` must be browser-reachable, while
`KRATOS_INTERNAL_URL` should use local HTTP for backend-to-Kratos calls.

Key cross-file wiring:

| Variable | File | Purpose |
| --- | --- | --- |
| `AUTH_URL` | `./.env` | Sets Hydra's login, consent, logout, and error UI origin and Kratos's UI origin |
| `AUTH_BASE_URL` | `monorepo/.env` | Builds the auth backend return URL after Kratos login |
| `KRATOS_SERVE_PUBLIC_BASE_URL` | `./.env` | Public origin Kratos writes into self-service flow actions |
| `KRATOS_PUBLIC_URL` | `monorepo/.env` | Browser-reachable Kratos origin used for redirects |
| `KRATOS_INTERNAL_URL` | `monorepo/.env` | Direct backend-to-Kratos public API connection |
| `KRATOS_COOKIES_DOMAIN` | `./.env` | Shared identity-session cookie scope, normally `.idnest.cloud` |

### 2.9 Bootstrap databases and Ory

Run from the repository root:

```bash
./scripts/bootstrap-local.sh
```

The bootstrap performs these operations:

1. Loads both env files.
2. Derives all PostgreSQL provisioning fields from the three database URLs.
3. Creates the Hydra, Kratos, and Authz roles/databases/schemas.
4. Runs Hydra, Kratos, and Authz migrations.
5. Starts the Hydra and Kratos containers.
6. Provisions only `idnest-admin-client`, the confidential infrastructure
   client required for the admin console to authenticate.

Product OAuth clients are not seeded by scripts. They are created in the admin
UI after the first administrator signs in.

The OS-specific setup scripts can also be run directly:

```bash
# macOS
./scripts/setup/setup-ory-macos.sh

# Linux
./scripts/setup/setup-ory-linux.sh
```

Those scripts perform database provisioning and Ory migrations, but the full
bootstrap is recommended for a new installation because it also migrates Authz,
starts the containers, and provisions the admin infrastructure client.

### 2.10 Start the applications

Use three terminals from `monorepo/`:

```bash
# Terminal 1
pnpm auth-backend:serve

# Terminal 2
pnpm admin-backend:serve

# Terminal 3
pnpm admin-frontend:serve
```

The default direct ports are defined in code: auth backend `4000`, admin backend
`4100`, and admin frontend `4501`.

Verify the services:

```bash
curl http://localhost:4444/health/ready
curl http://localhost:4433/health/ready
curl http://localhost:4000/health
curl -I https://admin-local.idnest.cloud
```

### 2.11 Sign in as the first administrator

1. Open `https://admin-local.idnest.cloud`.
2. Sign in with a verified email listed in `ADMIN_BOOTSTRAP_EMAILS`.
3. The admin backend grants the first `system-admin` role only if no active
   administrator exists.
4. Confirm that the Identities and OAuth Clients pages load.
5. Optionally clear `ADMIN_BOOTSTRAP_EMAILS` and restart `admin-backend` after
   the first administrator is established.

All later administrator roles, identity access grants, sessions, and product
OAuth clients are managed from the admin UI.

## 3. Daily development commands

Run workspace commands from `monorepo/`:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint

pnpm auth-backend:serve
pnpm admin-backend:serve
pnpm admin-frontend:serve

pnpm authz:migrate
```

Manage the Ory containers from the repository root:

```bash
docker compose -f scripts/docker/docker-compose.yml up -d
docker compose -f scripts/docker/docker-compose.yml logs -f
docker compose -f scripts/docker/docker-compose.yml down
```

After editing the root `.env` or `config/kratos.tpl.yml`, recreate Kratos so its
rendered configuration is refreshed:

```bash
docker compose -f scripts/docker/docker-compose.yml up -d --force-recreate ory-kratos
```

## 4. Manage OAuth clients and identity access

Use the admin console instead of static client files or seeding scripts.

### Create a product client

1. Open **OAuth Clients** in the admin console.
2. Create a unique `client_id` for the product.
3. For a browser SPA, select a public client using
   `token_endpoint_auth_method=none` and PKCE.
4. Set exact `redirect_uris` and `post_logout_redirect_uris`; do not use
   wildcard callback URLs.
5. Assign an app-specific audience.
6. Include only the required scopes, normally `openid profile email` and
   optionally `offline_access`.

For example, a Daybook browser client would use these values in the admin UI:

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

Use the equivalent `*-local` URLs while developing locally. Only first-party
clients may enable `remember_offline_access`; leave it disabled unless the
product requires refresh tokens without a repeated consent prompt.

### Grant identity access

Use either an identity detail page or a client detail page to grant/revoke
central access. Administrator roles are represented by a `system-admin` grant
for `idnest-admin-client`. The UI prevents revoking the final active system
administrator.

The admin console itself is the only client provisioned outside the UI. This is
an intentional bootstrap exception: the console cannot authenticate until its
own confidential client exists.

### Integrate a browser client

Hydra publishes OIDC discovery at:

```text
https://hydra.idnest.cloud/.well-known/openid-configuration
```

Use `https://hydra-local.idnest.cloud/.well-known/openid-configuration` locally.
A product SPA can configure
[`oidc-client-ts`](https://github.com/authts/oidc-client-ts) as follows:

```ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://hydra.idnest.cloud/",
  client_id: "daybook-user-client",
  redirect_uri: "https://app.daybook.cloud/auth/callback",
  post_logout_redirect_uri: "https://app.daybook.cloud/auth/logout",
  response_type: "code",
  scope: "openid profile email offline_access",
  extraQueryParams: { audience: "daybook.cloud-users" },
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// Start login:
userManager.signinRedirect();

// Complete /auth/callback:
await userManager.signinRedirectCallback();

// Start logout:
userManager.signoutRedirect();
```

The library generates PKCE values for the public client; never ship a client
secret in a browser application. The equivalent authorization request has this
shape:

```text
https://hydra.idnest.cloud/oauth2/auth
  ?client_id=daybook-user-client
  &response_type=code
  &scope=openid%20profile%20email%20offline_access
  &redirect_uri=https%3A%2F%2Fapp.daybook.cloud%2Fauth%2Fcallback
  &audience=daybook.cloud-users
  &state=<random>
  &code_challenge=<base64url-sha256-verifier>
  &code_challenge_method=S256
```

After the callback, exchange the returned code and original PKCE verifier at
`https://hydra.idnest.cloud/oauth2/token`. The browser uses Hydra's public
authorize/token endpoints and the auth UI; Hydra and Kratos admin URLs remain
server-side.

## 5. Authentication flow

```text
Product app
  → Hydra authorization endpoint
  → auth-backend login page
  → Kratos social login
  → auth-backend login return
  → Hydra consent
  → product callback with authorization code
```

Public browser clients must use Authorization Code + PKCE. Resource servers
must validate issuer, signature, expiration, and audience rather than trusting
browser state.

The complete server-rendered flow is:

1. The product sends an authorization request to Hydra with its client,
   redirect URI, scopes, audience, state, and PKCE challenge.
2. Hydra sends a `login_challenge` to `auth-backend` at `/login`.
3. The auth backend starts a Kratos browser login flow and renders the available
   Google/Apple provider buttons from that flow.
4. After social login, Kratos returns to `/login/return`. The backend resolves
   the Kratos session, forwards the session cookie server-side, and accepts the
   Hydra login challenge.
5. Hydra sends a `consent_challenge` to `/consent`. The backend checks the
   identity's client access and accepts only the requested scopes and registered
   audiences.
6. Hydra returns an authorization code to the product callback, where the
   product exchanges it with its PKCE verifier.
7. Logout terminates the Kratos session, relays the cookie-clearing response,
   and then accepts Hydra's logout challenge.

## 6. Build and deployment

```bash
cd monorepo
pnpm build
```

Production requirements:

- Use production `auth`, `hydra`, `kratos`, and `admin` hosts.
- Replace all development secrets and database credentials.
- Inject production secrets through a secret manager rather than checked-in env
  files.
- Use managed TLS certificates; `mkcert` is development-only.
- Use persistent PostgreSQL storage with backups.
- Keep ports `4445` and `4434` private.
- Run database migrations before starting new application versions.
- Render `apps/admin-frontend/public/config.tpl.json` into `config.json` during
  deployment.
- Run backend bundles from `monorepo/` so `dotenv/config` loads
  `monorepo/.env`.

Example PM2 startup:

```bash
cd monorepo
pm2 start dist/apps/auth-backend/main.cjs --name idnest-auth-backend --cwd "$PWD"
pm2 start dist/apps/admin-backend/main.cjs --name idnest-admin-backend --cwd "$PWD"
pm2 save
```

## 7. Troubleshooting

### Service health and logs

```bash
curl http://localhost:4444/health/ready
curl http://localhost:4433/health/ready
curl http://localhost:4000/health
docker compose -f scripts/docker/docker-compose.yml ps
docker compose -f scripts/docker/docker-compose.yml logs ory-hydra ory-kratos
```

Inspect the Kratos configuration actually rendered inside its container:

```bash
docker exec ory-kratos cat /etc/config/kratos.yml
```

### nginx or certificate errors

```bash
nginx -t                       # macOS
sudo nginx -t                  # Linux
mkcert -CAROOT
```

Ensure `/etc/hosts` contains all four local Idnest hosts and that nginx points
to the certificate location created for the current OS.

### Kratos config did not update

```bash
docker compose -f scripts/docker/docker-compose.yml up -d --force-recreate ory-kratos
docker compose -f scripts/docker/docker-compose.yml logs ory-kratos
```

### Admin login is forbidden

- Confirm the login email is verified by Kratos.
- Confirm it matches `ADMIN_BOOTSTRAP_EMAILS` when no administrator exists.
- Confirm `ADMIN_OIDC_CLIENT_SECRET` matches the provisioned admin client.
- Confirm Authz migrations completed and `admin-backend` can reach
  `AUTHZ_DATABASE_URL`.

### Force Google to show account selection

Visit `https://accounts.google.com/Logout`, then start the login flow again in a
new private browser window.

## 8. Security notes

- Never expose Hydra or Kratos admin ports publicly.
- Keep `.env` files out of version control; both are gitignored.
- Rotate credentials that have ever been shared or committed.
- The admin browser holds only an opaque, HttpOnly BFF session cookie.
- Every admin API request revalidates the session, Kratos identity state,
  verified email, and active `system-admin` grant.
- The first-admin email allowlist is effective only while zero active system
  administrators exist.
- Product identities are federated through Google/Apple; provider logins without
  a verified email are rejected before tokens are issued.
- Social account linking uses Kratos's explicit account-settings flow rather
  than silently joining accounts by email.
- Hiding UI controls is not an authorization boundary; enforcement lives in
  `admin-backend`.
