import { randomUUID } from "node:crypto";

/**
 * Server-side configuration for the admin API.
 *
 * Like auth-backend, the Hydra/Kratos *admin* URLs are privileged and must
 * never reach the browser. admin-backend additionally needs the Kratos
 * *public* URL (to validate the caller's session via `whoami`) and the
 * bootstrap admin allowlist — both server-side only.
 */

export const getHydraAdminUrl = (): string => process.env.HYDRA_ADMIN_URL ?? "";
export const getKratosAdminUrl = (): string => process.env.KRATOS_ADMIN_URL ?? "";

/** Public Kratos URL used for the `/sessions/whoami` authorization check. */
export const getKratosPublicUrl = (): string => process.env.KRATOS_PUBLIC_URL ?? "";

/**
 * Kratos public API base for this backend's server-to-server `whoami` call.
 * Defaults to the public URL, but set KRATOS_INTERNAL_URL to the internal
 * http:// address (e.g. http://localhost:4433) so the call skips TLS / nginx
 * and avoids needing the local mkcert CA in Node's trust store.
 */
export const getKratosInternalUrl = (): string =>
  process.env.KRATOS_INTERNAL_URL ?? getKratosPublicUrl();

export const getPort = (): number => Number(process.env.ADMIN_BACKEND_PORT ?? 4100);

/** Comma-separated allowlist of browser origins permitted to call the admin API. */
export const getAdminCorsOrigins = (): string[] =>
  (process.env.ADMIN_CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const fallbackCsrfSecret = randomUUID();

/** Secret used to sign stateless admin CSRF tokens. */
export const getAdminCsrfSecret = (): string =>
  process.env.ADMIN_CSRF_SECRET ?? process.env.KRATOS_CSRF_COOKIE_SECRET ?? fallbackCsrfSecret;

/**
 * Bootstrap admin emails (1-2 expected), normalized to lowercase + trimmed.
 * These seed the very first admins; everyone else is granted via
 * `metadata_admin.role === "admin"` through the admin API itself.
 */
export const getBootstrapAdminEmails = (): string[] =>
  (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
