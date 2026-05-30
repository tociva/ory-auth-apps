import { InjectionToken } from "@angular/core";

/**
 * Browser-public admin configuration. The privileged Hydra/Kratos admin URLs
 * never reach the browser — they live only in admin-backend. The SPA talks to
 * admin-backend (which enforces authorization) and, for login redirects, to
 * the server-rendered auth-backend login page.
 *
 * Loaded at runtime from `public/config.json` (see `main.ts`) so a single
 * build can be deployed to many environments — the deploy just swaps the
 * `config.json` file. Values are merged over DEFAULT_ADMIN_CONFIG.
 */
export interface AdminConfig {
  /** admin-backend base, e.g. https://admin-api.daybook.cloud/api (admin routes live under `${adminBackendUrl}/admin`). */
  adminBackendUrl: string;
  /** Where to send unauthenticated users to sign in. */
  authLoginUrl: string;
}

export const ADMIN_CONFIG = new InjectionToken<AdminConfig>("ADMIN_CONFIG");

/** Dev fallback used when `config.json` is missing or unreadable. */
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  adminBackendUrl: "http://localhost:4100/api",
  authLoginUrl: "http://localhost:4000/login",
};
