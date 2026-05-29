import { InjectionToken } from "@angular/core";

/**
 * Browser-public auth configuration. These are the only URLs the SPA needs;
 * the privileged Hydra/Kratos *admin* URLs live exclusively in auth-backend.
 *
 * Loaded at runtime from `public/config.json` (see `main.ts`) so a single
 * build can be deployed to many environments — the deploy just swaps the
 * `config.json` file. Values are merged over DEFAULT_AUTH_CONFIG.
 */
export interface AppConfig {
  /** Kratos public endpoint, e.g. https://auth.daybook.cloud/kratos */
  kratosPublicUrl: string;
  /** Where Kratos sends the browser back after login. */
  kratosReturnTo: string;
  /** auth-backend base URL (the Hydra proxy lives under `${authBackendUrl}/hydra`). */
  authBackendUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>("APP_CONFIG");

/** Dev fallback used when `config.json` is missing or unreadable. */
export const DEFAULT_AUTH_CONFIG: AppConfig = {
  kratosPublicUrl: "http://localhost:4433",
  kratosReturnTo: "http://localhost:4200/handle-login-return",
  authBackendUrl: "http://localhost:4000/api",
};
