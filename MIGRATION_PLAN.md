# Daybook.cloud Auth — Migration & Test Plan

Status: Draft · Owner: Prince Francis · Last updated: 2026-05-29

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
- Hydra v2.3.0 + Kratos v1.3.1 run as Docker images; PostgreSQL backing store
  (separate `hydra` and `kratos` databases).
- Cookie domain `.daybook.cloud` gives SSO across subdomains.

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

- [ ] Create Nx workspace (pnpm). Pin **Nx ≥ 22.3** and **Angular ≥ 21.1**.
- [ ] Configure Vitest as the test runner across apps/libs.
- [ ] Scaffold `apps/auth-frontend`, `apps/auth-backend`, `libs/shared-types`.
- [ ] Pin exact (no `^`) versions for all pre-1.0 `@tailng-ui/*` packages.

### 2.2 Backend (`apps/auth-backend`, TS Express)

- [ ] Port the five handlers 1:1: `accept-login`, `accept-consent`,
      `get-consent`, `reject-consent`, `accept-logout`.
- [ ] Keep Hydra/Kratos admin URLs server-side only.
- [ ] Apply the Phase 1.3 consent fixes here too.

### 2.3 Frontend (`apps/auth-frontend`, Angular + TailNG)

- [ ] Rebuild login/consent/logout/error/handle-login-return pages.
- [ ] Use `withCredentials: true` on all browser requests.
- [ ] Read `csrf_token` from Kratos flows and submit it.
- [ ] Use full-page form POST / navigation for the Google OIDC step (not XHR).
- [ ] Reuse `libs/shared-types`.

### 2.4 Multi-app enablement

- [ ] **(blocker)** Parameterize `create-hydra-client.js` to loop over an app
      list; one Hydra client per app with its own `client_id`, `redirect_uris`,
      `post_logout_redirect_uris`, `audience`.
- [ ] Enforce PKCE for public SPA clients.
- [ ] Add every app + backend origin to `CORS_ALLOWED_ORIGINS`.

---

## Phase 3 — Admin UI

### 3.1 Apps

- [ ] Scaffold `apps/admin-frontend` (Angular + TailNG) and
      `apps/admin-backend` (TS Express) in the same monorepo.
- [ ] Deploy admin on a restricted subdomain (e.g. `admin.daybook.cloud`),
      ideally behind IP allowlist / VPN.

### 3.2 Privilege separation

- [ ] Give only `admin-backend` broad Hydra/Kratos admin access (least
      privilege vs `auth-backend`).
- [ ] Register admin as its own Hydra OAuth client.

### 3.3 Authorization (allowlist)

- [ ] **(!)** Add bootstrap admin emails (1–2) to `.env`, server-side only.
- [ ] **(!)** Use Kratos `metadata_admin` (e.g. `{ "role": "admin" }`) as the
      runtime source of truth; settable only via admin API.
- [ ] **(!)** Enforce authorization in `admin-backend` on every request:
      validate Kratos session via `whoami`, then check bootstrap list +
      `metadata_admin`. Reject otherwise.
- [ ] Normalize emails (lowercase + trim) and require Google `email_verified`.
- [ ] Never rely on hiding UI elements as a security boundary.

### 3.4 Admin features (initial)

- [ ] List / view / deactivate / delete Kratos identities.
- [ ] Grant / revoke admin role (`metadata_admin`).
- [ ] Manage Hydra OAuth clients (create / edit / delete).
- [ ] View / revoke sessions and consent grants.

---

## Test Cases (Vitest) — categorized per project

Each box is one test. Backend tests mock `fetch` to Hydra/Kratos admin APIs;
frontend tests use the Angular + Vitest setup; shared-types tests are type/
schema guards.

> NOTE: Tests for the CURRENT Next.js handlers are implemented under
> `src/app/api/hydra/__tests__/` with `vitest.config.ts` and an `npm test`
> script. They could NOT be executed in the build sandbox (npm install is
> blocked — `403 Forbidden` from the registry). Run `npm install && npm test`
> locally to verify. These port to `apps/auth-backend` in Phase 2.

### auth-backend (current Next.js handlers → ports to `apps/auth-backend`)

**accept-login** (`__tests__/accept-login.test.ts`)
- [x] Returns `redirect_to` on a valid `login_challenge` + subject.
- [x] Sends `remember`, `acr: aal1`, and `context.id_token` in the PUT body.
- [x] Returns 500 with the Hydra error text when Hydra responds non-OK.
- [ ] Returns 400/handled error when `login_challenge` is missing. (Handler
      does not yet guard this — add guard + test in Phase 2.)
- [x] Surfaces network/fetch failure as a JSON error.

**accept-consent** (`__tests__/accept-consent.test.ts`)
- [x] Fetches the consent request, then the Kratos identity by subject.
- [x] **(regression)** Grants exactly `requested_scope` — not a hardcoded list.
- [x] **(regression)** Grants exactly `requested_access_token_audience` — not a
      hardcoded audience.
- [x] Maps Kratos traits (name/email/picture) into id_token + access_token.
- [x] Returns error JSON when the Kratos identity lookup fails.
- [ ] Returns error JSON when Hydra accept fails. (Covered indirectly; add
      explicit case in Phase 2.)
- [x] Handles missing `consent_challenge` (400).

**get-consent** — route removed in Stage 1.7; tests N/A.

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

**authorization middleware**
- [ ] Rejects requests with no valid Kratos session (401).
- [ ] **(!)** Rejects authenticated-but-not-allowlisted users (403).
- [ ] Allows users in the `.env` bootstrap list.
- [ ] Allows users with `metadata_admin.role === 'admin'`.
- [ ] Email match is case-insensitive and trimmed.
- [ ] Rejects when Google `email_verified` is false.

**identity management**
- [ ] Lists identities (pagination passthrough).
- [ ] Gets a single identity by id.
- [ ] Deactivates / deletes an identity and handles not-found.
- [ ] Grants / revokes `metadata_admin` role.

**oauth client management**
- [ ] Creates a Hydra client with the expected payload.
- [ ] Updates / deletes a client; handles 404.
- [ ] Rejects creation with invalid/missing fields.

**session management**
- [ ] Lists and revokes sessions; handles errors.

### admin-frontend (`apps/admin-frontend`)

- [ ] Redirects to login when unauthenticated.
- [ ] Renders "not authorized" for a logged-in non-admin.
- [ ] Renders the dashboard for an admin.
- [ ] Identity list/detail components render API data.
- [ ] Client create/edit form validates input before submit.
- [ ] Role toggle calls the grant/revoke endpoint.

### libs/shared-types

- [ ] `KratosUser` / identity guard accepts valid, rejects malformed payloads.
- [ ] `HydraConsentRequest` / `HydraConsentResponse` guards hold.
- [ ] Round-trip parse of a sample Kratos identity and Hydra consent payload.

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
