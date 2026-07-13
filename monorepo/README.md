# idnest.dev Auth — Nx Monorepo

This workspace is the Phase 2/3 restructure described in
`../MIGRATION_PLAN.md`. It splits the old single Next.js app into:

| Project                | Type                     | Purpose                                                        |
| ---------------------- | ------------------------ | ------------------------------------------------------------- |
| `apps/auth-backend`    | TypeScript Express       | Hydra/Kratos proxy **and** server-rendered login/consent/logout/error pages |
| `apps/admin-backend`   | TypeScript Express       | Privileged admin API (identities, clients, roles)             |
| `apps/admin-frontend`  | Angular 21 + TailNG      | Staff-only admin console                                      |
| `libs/shared-types`    | TS library               | Kratos/Hydra interfaces + runtime guards                      |

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
pnpm auth-backend:serve   # start the auth API + server-rendered pages on :4000
pnpm admin-backend:serve  # start the admin API on :4100
pnpm admin-frontend:serve # start the admin UI dev server
pnpm hydra:admin-client   # register/refresh the protected Idnest admin OAuth client
pnpm hydra:clients        # compatibility alias for hydra:admin-client
```

## OAuth Clients

The local bootstrap only provisions the protected Idnest admin client:

```bash
HYDRA_ADMIN_URL=http://localhost:4445 ADMIN_OIDC_CLIENT_SECRET=<secret> pnpm hydra:admin-client
```

- Product OAuth clients should be created and managed through the admin portal.
- Public browser SPAs must use `token_endpoint_auth_method=none` with PKCE.
- The Idnest Admin client is confidential and terminates OAuth in
  `admin-backend`; the browser only holds an HttpOnly BFF session cookie.
- Every app needs its own `redirect_uris`, `post_logout_redirect_uris`, and
  `audience` so tokens stay scoped and audience-isolated.
- Add every app origin **and** the auth-backend origin to
  `CORS_ALLOWED_ORIGINS` in `.env` (consumed by both Hydra and `auth-backend`).

## Security notes (carried from Phase 1)

- Admin URLs (`HYDRA_ADMIN_URL`, `KRATOS_ADMIN_URL`) are read server-side only
  and never shipped to the browser.
- Admin authorization is enforced in `admin-backend` on **every** request:
  DB-backed BFF session → Kratos identity lookup → active
  `client_access_grants` row for `idnest-admin-client` with role
  `system-admin` → verified email. Hiding UI is never the boundary.
- Rotate any secrets that previously lived in the working tree.
