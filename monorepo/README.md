# idnest.dev Auth — Nx Monorepo

This workspace is the Phase 2/3 restructure described in
`../MIGRATION_PLAN.md`. It splits the old single Next.js app into:

| Project                | Type                     | Purpose                                            |
| ---------------------- | ------------------------ | -------------------------------------------------- |
| `apps/auth-backend`    | TypeScript Express       | Narrow Hydra/Kratos proxy for the login/consent UI |
| `apps/auth-frontend`   | Angular 21 + TailNG      | Public login / consent / logout / error UI         |
| `apps/admin-backend`   | TypeScript Express       | Privileged admin API (identities, clients, roles)  |
| `apps/admin-frontend`  | Angular 21 + TailNG      | Staff-only admin console                           |
| `libs/shared-types`    | TS library               | Kratos/Hydra interfaces + runtime guards           |

Ory Hydra + Kratos stay as Docker images; PostgreSQL is unchanged.

## Prerequisites

- Node `>= 20.11`
- pnpm `9.15+`
- Running Hydra (admin :4445) + Kratos (admin :4434, public :4433)

## Setup

```bash
cp .env.example .env   # then fill in real values
pnpm install
```

> The files in this workspace were authored by hand (the build sandbox could
> not run package installs). Run `pnpm install` locally to resolve the
> dependency tree, then verify with the commands below.

## Common commands

```bash
pnpm test                 # run vitest across all projects
pnpm typecheck            # tsc --noEmit across all projects
pnpm auth-backend:serve   # start the auth API on :4000
pnpm admin-backend:serve  # start the admin API on :4100
pnpm auth-frontend:serve  # start the auth UI dev server
pnpm hydra:clients        # register/refresh Hydra OAuth clients (tools/apps.config.json)
```

## Multi-app (one Hydra client per app)

Each product app authenticates through its own Hydra OAuth client. Define them
in [`tools/apps.config.json`](tools/apps.config.json) and register/refresh them
with:

```bash
HYDRA_ADMIN_URL=http://localhost:4445 pnpm hydra:clients
```

- `public: true` marks browser SPAs: they are created with
  `token_endpoint_auth_method=none`, which makes Hydra **require PKCE** for that
  client. Also set `oauth2.pkce.enforced_for_public_clients=true` on the Hydra
  server for defense in depth.
- Every app needs its own `redirect_uris`, `post_logout_redirect_uris` and
  `audience` so tokens stay scoped and audience-isolated.
- Add every app origin **and** the auth-backend origin to
  `CORS_ALLOWED_ORIGINS` in `.env` (consumed by both Hydra and `auth-backend`).

## Security notes (carried from Phase 1)

- Admin URLs (`HYDRA_ADMIN_URL`, `KRATOS_ADMIN_URL`) are read server-side only
  and never shipped to the browser.
- Admin authorization is enforced in `admin-backend` on **every** request:
  Kratos `whoami` → bootstrap allowlist OR `metadata_admin.role === 'admin'` →
  require Google `email_verified`. Hiding UI is never the boundary.
- Rotate any secrets that previously lived in the working tree.
