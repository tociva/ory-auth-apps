import { InjectionToken } from "@angular/core";

/**
 * Browser-public admin configuration. The privileged Hydra/Kratos admin URLs
 * and the confidential admin OAuth client secret never reach the browser. The
 * SPA talks to the same-origin admin BFF, which owns OAuth and session state.
 *
 * Loaded at runtime from `public/config.json` (see `main.ts`) so a single
 * build can be deployed to many environments — the deploy just swaps the
 * `config.json` file. Values are merged over DEFAULT_ADMIN_CONFIG.
 */
export interface AdminConfig {
  /** BFF API base, normally same-origin `/api` (admin routes live under `${apiBaseUrl}/admin`). */
  apiBaseUrl: string;
  /** Browser-facing auth-backend logout URL used to clear Kratos/Hydra SSO state. */
  authLogoutUrl?: string;
}

export const ADMIN_CONFIG = new InjectionToken<AdminConfig>("ADMIN_CONFIG");

/** Dev fallback used when `config.json` is missing or unreadable. */
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  apiBaseUrl: "/api",
};
