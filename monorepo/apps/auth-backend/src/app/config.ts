/**
 * Server-side configuration. The Hydra/Kratos *admin* URLs are privileged and
 * must never be shipped to or echoed back to the browser - they are read from
 * the environment here and used only inside backend handlers.
 */

export const getHydraAdminUrl = (): string => process.env.HYDRA_ADMIN_URL ?? "";
export const getKratosAdminUrl = (): string => process.env.KRATOS_ADMIN_URL ?? "";

export const getPort = (): number => Number(process.env.AUTH_BACKEND_PORT ?? 4000);

/** Comma-separated allowlist of browser origins permitted to call this API. */
export const getCorsOrigins = (): string[] =>
  (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
