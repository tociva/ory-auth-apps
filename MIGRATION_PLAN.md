# idnest.dev Auth — Migration & Test Plan

Status: Phase 1 & 2 complete · Phase 3 (admin) not started · Owner: Prince Francis · Last updated: 2026-05-29

This plan covers (1) fixing the current Ory Hydra + Kratos + Next.js auth app,
(2) restructuring into an Nx monorepo with a split Angular frontend + Express
backend, and (3) adding a login-protected admin UI. It ends with Vitest test
cases categorized per project.

Legend: `- [ ]` = to do · `- [x]` = done · **(!)** = security-sensitive ·
**(blocker)** = blocks multi-app.

---

## 0. Current State (baseline)

- Single Next.js app serves both the auth UI (login/consent/logout/error/
  handle-login-return) and the privileged `/api/hydra/*` admin-proxy routes.
- Identity: Google OIDC only (username/password intentionally removed).
- Hydra v26.2.0 + Kratos v25.4.0 run as Docker images; PostgreSQL backing store
  (separate `hydra` and `kratos` databases).
- Cookie domain `.idnest.dev` gives SSO across subdomains.

## Target Architecture

- **Nx monorepo** (pnpm) containing:
  - `apps/auth-frontend` — Angular 21.1+, TailNG (`@tailng-ui/*`), public.
  - `apps/auth-backend` — TypeScript Express; narrow Hydra/Kratos privileges.
  - `apps/admin-frontend` — Angular 21.1+, TailNG; staff-only.
  - `apps/admin-backend` — TypeScript Express; broad Hydra/Kratos admin access.
  - `libs/shared-types` — Kratos identity, Hydra client/consent interfaces.
- Hydra + Kratos remain Docker images; PostgreSQL unchanged.
- N product apps consume auth via their own Hydra OAuth clients.

---

## Phase 1 — Fix the current auth setup

Do these before restructuring; several are correctness/security bugs.

### 1.1 Kratos config (`config/kratos.tpl.yml`)

- [x] Add OIDC session hook so first-time Google sign-ups get a session:
      `selfservice.flows.registration.after.oidc.hooks: [ { hook: session } ]`.
- [x] **(!)** Set `log.leak_sensitive_values: false`.
- [x] Decide on `recovery` / `verification` / `settings` flows: disabled
      recovery + verification (no UI, no real SMTP). `settings` left in place
      (still referenced by 2FA methods); build its UI later if needed.
- [ ] If keeping email flows, replace the mailslurper test SMTP with real SMTP.
      (Deferred — recovery/verification disabled for now.)
- [x] Removed `registration.after.password` block, replaced with `oidc` session
      hook. (`hashers.bcrypt` left as a harmless default.)

### 1.2 Secrets hygiene

- [x] **(!)** Stripped secrets from the stale rendered `config/kratos.yml`
      (could not unlink it in the sandbox; overwrote with a stub). Docker
      regenerates it from the `.tpl` via `envsubst` at startup.
- [x] **(!)** Confirmed `.env` and `kratos.yml` stay gitignored (they are;
      `.gitignore:43 kratos.yml`).
- [ ] **(!)** ACTION REQUIRED (manual): rotate exposed secrets — Google client
      secret, `HYDRA_SECRETS_SYSTEM`, both DB passwords, Kratos cookie + cipher
      secrets. They were present in the working tree and should be considered
      compromised.
- [ ] Move secrets to a proper secret manager / env injection for deploys.

### 1.3 Consent route (`src/app/api/hydra/accept-consent/route.ts`)

- [x] **(blocker)** Grant `consentRequest.requested_scope` instead of the
      hardcoded scope array.
- [x] **(blocker)** Grant `consentRequest.requested_access_token_audience`
      instead of the hardcoded `['daybook.cloud-users']`.
- [x] Wrap the handler in try/catch and return JSON errors (consistent with
      the other routes); added missing `consent_challenge` 400 guard.
- [ ] Decide whether to gate auto-consent to a trusted `client_id` allowlist.
      (Deferred to Phase 2.4 / Phase 3 when multiple clients exist.)

### 1.4 Logout (`src/app/logout/LogoutClient.tsx`)

- [x] **(!)** Fix Kratos logout: read `logout_token`/`logout_url` from
      `self-service/logout/browser` and call the returned `logout_url` so the
      Kratos session is actually terminated.
- [x] Ensure both Kratos and Hydra sessions end, then redirect.
- [x] Stopped silently dropping the init; 401 (no session) is handled as a
      no-op before proceeding to the Hydra logout.

### 1.5 Login UI (`src/app/components/login/LoginForm.tsx`)

- [x] Remove non-Google provider buttons (Apple/Facebook/Twitter/LinkedIn/
      GitHub) and their imports. (Orphaned icon component files left in
      `components/login/` — harmless; delete later if desired.)

### 1.6 Error page (`src/app/error/ErrorClient.tsx`)

- [x] Limit raw error JSON exposed to the user via a `pickSafeDetails`
      whitelist (error code, description, hint, reference id only); both the
      display and the Copy button use the curated subset.

### 1.7 Cleanup

- [x] Removed the unused `get-consent` route (no references in `src/`; consent
      auto-accepts via `ConsentClient`). Re-add if a real consent screen is
      built later.

---

## Phase 2 — Restructure (Nx monorepo + split + multi-app)

### 2.1 Workspace

- [x] Create Nx workspace (pnpm). Pinned **Nx 22.3** and **Angular 21.2**
      (`monorepo/`, pnpm 9.15).
- [x] Configure Vitest as the test runner across apps/libs.
- [x] Scaffold `apps/auth-frontend`, `apps/auth-backend`, `libs/shared-types`.
- [x] Pin exact (no `^`) versions for all pre-1.0 `@tailng-ui/*` packages
      (cdk 0.43.0, components 0.69.0, icons 0.14.0, primitives 0.59.0,
      theme 0.49.0).

### 2.2 Backend (`apps/auth-backend`, TS Express)

- [x] Port the handlers: `accept-login`, `accept-consent`, `reject-consent`,
      `accept-logout`. (`get-consent` was removed in Stage 1.7 and is NOT
      ported — consent auto-accepts; re-add only if a real consent screen is
      built.)
- [x] Keep Hydra/Kratos admin URLs server-side only (`app/config.ts` reads
      them from env; never sent to the client).
- [x] Apply the Phase 1.3 consent fixes here too (echo `requested_scope` and
      `requested_access_token_audience`). Also added the `accept-login`
      `login_challenge` 400 guard that was missing in the Next.js version.

### 2.3 Frontend (`apps/auth-frontend`, Angular + TailNG)

- [x] Rebuild login/consent/logout/error/handle-login-return pages.
- [x] Use `withCredentials: true` on all browser requests
      (`auth-api.service.ts`, `kratos.service.ts`).
- [x] Read `csrf_token` from Kratos flows and submit it (`login.component.ts`).
- [x] Use full-page form POST / navigation for the Google OIDC step (not XHR)
      (`form.submit()` / `window.location` in `login.component.ts`).
- [x] Reuse `libs/shared-types`.

### 2.4 Multi-app enablement

- [x] **(blocker)** Parameterize the client script: `tools/create-hydra-clients.mjs`
      loops over `tools/apps.config.json`; one Hydra client per app with its own
      `client_id`, `redirect_uris`, `post_logout_redirect_uris`, `audience`.
- [x] Enforce PKCE for public SPA clients at the client level
      (`token_endpoint_auth_method=none`). See also 2.5 for the server-side flag.
- [x] Add every app + backend origin to `CORS_ALLOWED_ORIGINS`
      (`monorepo/.env.example`).

### 2.5 Remaining Phase 2 hardening

- [x] **(!)** Set Hydra `oauth2.pkce.enforced_for_public_clients=true` on the
      server (defense-in-depth beyond the per-client `auth_method=none`).
      Added to `docker-compose.yml`.

---

## Phase 3 — Admin UI

### 3.1 Apps

- [x] Scaffold `apps/admin-backend` (TS Express) in the monorepo
      (config, routes, handlers, auth middleware, Vitest).
- [x] Scaffold `apps/admin-frontend` (Angular + TailNG, serve :4201). Uses only
      `@tailng-ui/components` for UI. Pages: identities list, identity detail
      (role toggle / deactivate / delete / sessions), OAuth clients
      (list + create/edit form + delete), forbidden. Route-guarded via
      `GET /api/admin/me`. Added that probe route to `admin-backend`.
- [ ] Deploy admin on a restricted subdomain (e.g. `admin.idnest.dev`),
      ideally behind IP allowlist / VPN.

### 3.2 Privilege separation

- [x] Give only `admin-backend` broad Hydra/Kratos admin access (it reads the
      Hydra/Kratos *admin* URLs; `auth-backend` keeps its narrow proxy). URLs
      stay server-side in `admin-backend/src/app/config.ts`.
- [x] Register admin as its own Hydra OAuth client — added the
      `dev.idnest.dev-admin-client` (public + PKCE) entry to
      `tools/apps.config.json`; provision with `pnpm hydra:clients`.

### 3.3 Authorization (allowlist)

- [x] **(!)** Add bootstrap admin emails (1–2) to `.env`, server-side only
      (`ADMIN_BOOTSTRAP_EMAILS`, read by `getBootstrapAdminEmails()`).
- [x] **(!)** Use Kratos `metadata_admin` (`{ "role": "admin" }`) as the
      runtime source of truth; set only via the admin API (`setAdminRole`).
- [x] **(!)** Enforce authorization in `admin-backend` on every request:
      `requireAdmin()` is mounted with `router.use(...)`, validates the Kratos
      session via `whoami`, then checks bootstrap list + `metadata_admin`;
      rejects with 401 (no session) / 403 (not authorized).
- [x] Normalize emails (lowercase + trim) and require a verified email
      (`email_verified` via Kratos `verifiable_addresses`).
- [x] Never rely on hiding UI elements as a security boundary (the boundary is
      the server-side `requireAdmin` check, not the admin UI).

### 3.4 Admin features (initial)

- [x] List / view / deactivate / delete Kratos identities (`handlers/identities.ts`).
- [x] Grant / revoke admin role via `metadata_admin` (`setAdminRole`).
- [x] Manage Hydra OAuth clients — create / edit / delete (`handlers/clients.ts`).
- [x] View / revoke sessions (`handlers/sessions.ts`). Consent-grant
      listing/revocation still TODO (Hydra `/admin/oauth2/auth/sessions/consent`).

---

## Test Cases (Vitest) — categorized per project

Each box is one test. Backend tests mock `fetch` to Hydra/Kratos admin APIs;
frontend tests use the Angular + Vitest setup; shared-types tests are type/
schema guards.

> NOTE: The Next.js handler tests have been PORTED to the monorepo at
> `monorepo/apps/auth-backend/src/app/__tests__/` (Vitest). They have not been
> executed in any sandbox (package installs are blocked, and the committed
> `node_modules` is built for macOS so it lacks the Linux rollup native
> binary). Run `pnpm install && pnpm test` locally to verify. Frontend, admin,
> and shared-types test suites are still to be written (see Phase 3).

### auth-backend (current Next.js handlers → ports to `apps/auth-backend`)

**accept-login** (`__tests__/accept-login.test.ts`)
- [x] Returns `redirect_to` on a valid `login_challenge` + subject.
- [x] Sends `remember`, `acr: aal1`, and `context.id_token` in the PUT body.
- [x] Returns 500 with the Hydra error text when Hydra responds non-OK.
- [x] Returns 400/handled error when `login_challenge` is missing. (Guard added
      in the `apps/auth-backend` port; add the explicit test alongside it.)
- [x] Surfaces network/fetch failure as a JSON error.

**accept-consent** (`__tests__/accept-consent.test.ts`)
- [x] Fetches the consent request, then the Kratos identity by subject.
- [x] **(regression)** Grants exactly `requested_scope` — not a hardcoded list.
- [x] **(regression)** Grants exactly `requested_access_token_audience` — not a
      hardcoded audience.
- [x] Maps Kratos traits (name/email/picture) into id_token + access_token.
- [x] Returns error JSON when the Kratos identity lookup fails.
- [x] Returns error JSON when Hydra accept fails. (Explicit case added in the
      `apps/auth-backend` port.)
- [x] Handles missing `consent_challenge` (400).

**get-consent** — route removed in Stage 1.7; not ported to `auth-backend`;
tests N/A.

**reject-consent** (`__tests__/reject-consent.test.ts`)
- [x] Sends `error: access_denied` and returns `redirect_to`.
- [x] Returns 500 on Hydra error.

**accept-logout** (`__tests__/accept-logout.test.ts`)
- [x] Returns `redirect_to` on a valid `logout_challenge`.
- [x] Returns 400 when `logout_challenge` is missing.
- [x] Returns 500 on Hydra error / fetch failure.

**security / config**
- [ ] Admin URLs are read from env and never echoed to the client.
- [ ] **(!)** Auto-consent only proceeds for allowlisted client_ids (if gating
      is enabled).

### auth-frontend (`apps/auth-frontend`)

**LoginForm**
- [ ] Redirects to the Kratos browser login flow when no `flow` is present.
- [ ] Preserves `login_challenge` in the `return_to` it builds.
- [ ] Submits a form POST with `provider=google` (and `login_hint` when set).
- [ ] Shows an error when an OIDC action is attempted with no flow.
- [ ] Renders only the Google provider (after Phase 1.5).

**handle-login-return**
- [ ] Polls `whoami`, sets the user on 200, and stops the retry loop.
- [ ] Retries up to max on 401, then shows the retry UI.
- [ ] On user + `login_challenge`, calls accept-login and redirects.
- [ ] Surfaces accept-login failure as an error with a retry button.

**consent**
- [ ] Posts the `consent_challenge` and redirects to `redirect_to`.
- [ ] Shows an error + "Go to Login" when accept fails or no redirect.

**logout**
- [ ] **(regression)** Performs the full Kratos logout (init → follow
      `logout_url`) so the session is actually destroyed.
- [ ] Then accepts the Hydra logout and redirects.
- [ ] Shows the error state with Try-again when logout fails.

**error page**
- [ ] Renders OAuth errors from query params.
- [ ] Fetches Kratos error details by `id`.
- [ ] Shows the human hint for `redirect_uri` mismatch.
- [ ] Does not render sensitive internal fields (after Phase 1.6).

### admin-backend (`apps/admin-backend`)

**authorization middleware** (`__tests__/authorize.test.ts`)
- [x] Rejects requests with no valid Kratos session (401). (also: no cookie,
      inactive session.)
- [x] **(!)** Rejects authenticated-but-not-allowlisted users (403).
- [x] Allows users in the `.env` bootstrap list.
- [x] Allows users with `metadata_admin.role === 'admin'`.
- [x] Email match is case-insensitive and trimmed.
- [x] Rejects when Google `email_verified` is false.

**identity management** (`__tests__/identities.test.ts`)
- [x] Lists identities (pagination passthrough).
- [x] Gets a single identity by id.
- [x] Deactivates / deletes an identity and handles not-found.
- [x] Grants / revokes `metadata_admin` role.

**oauth client management** (`__tests__/clients.test.ts`)
- [x] Creates a Hydra client with the expected payload (public→PKCE).
- [x] Updates / deletes a client; handles 404.
- [x] Rejects creation with invalid/missing fields.

**session management** (`__tests__/sessions.test.ts`)
- [x] Lists and revokes sessions (per-identity + single session); handles
      missing ids (400) and not-found (404).

### admin-frontend (`apps/admin-frontend`)

- [ ] Redirects to login when unauthenticated.
- [ ] Renders "not authorized" for a logged-in non-admin.
- [ ] Renders the dashboard for an admin.
- [ ] Identity list/detail components render API data.
- [ ] Client create/edit form validates input before submit.
- [ ] Role toggle calls the grant/revoke endpoint.

### libs/shared-types

- [x] `KratosUser` / identity guard accepts valid, rejects malformed payloads
      (`kratos.test.ts`).
- [x] `HydraConsentRequest` / redirect-response guards hold (`hydra.test.ts`).
- [x] Round-trip parse of a sample Kratos identity and Hydra consent payload.
- [x] (bonus) `toUserClaims` projection and `getCsrfToken` extraction covered.

### config / integration (optional, higher effort)

- [ ] Kratos config renders from `.tpl` via `envsubst` without unset vars.
- [ ] OIDC mapper jsonnet maps Google claims → traits correctly.
- [ ] End-to-end: login → consent → token issuance against a test Hydra/Kratos.
- [ ] End-to-end: logout terminates both Kratos and Hydra sessions.

---

## Cross-cutting / Done-criteria

- [ ] All Phase 1 security items resolved and secrets rotated.
- [ ] Vitest green in CI across all projects.
- [ ] Multi-app verified with a second Hydra client end-to-end.
- [ ] Admin access proven to require both authentication and authorization.
