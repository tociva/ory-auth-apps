/**
 * Server-side configuration. The Hydra/Kratos *admin* URLs are privileged and
 * must never be shipped to or echoed back to the browser - they are read from
 * the environment here and used only inside backend handlers.
 */

export const getHydraAdminUrl = (): string => process.env.HYDRA_ADMIN_URL ?? "";
export const getKratosAdminUrl = (): string => process.env.KRATOS_ADMIN_URL ?? "";

/**
 * Kratos *public* base URL. Used server-side to start the browser login flow,
 * read the flow's CSRF token, and run whoami / logout on the user's behalf
 * (the browser's `ory_kratos_session` cookie is forwarded — see kratos-public).
 */
export const getKratosPublicUrl = (): string =>
  process.env.KRATOS_PUBLIC_URL ?? "http://localhost:4433";

/**
 * This service's own public origin (e.g. https://auth.idnest.dev). Used to
 * build the `return_to` URL Kratos sends the browser back to after login.
 */
export const getAuthBaseUrl = (): string =>
  (process.env.AUTH_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const getPort = (): number => Number(process.env.AUTH_BACKEND_PORT ?? 4000);

/** Comma-separated allowlist of browser origins permitted to call this API. */
export const getCorsOrigins = (): string[] =>
  (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
