import { InjectionToken } from "@angular/core";

/**
 * Browser-public auth configuration. These are the only URLs the SPA needs;
 * the privileged Hydra/Kratos *admin* URLs live exclusively in auth-backend.
 *
 * Values come from the `NG_APP_*` deploy-time variables (see `.env.example`)
 * which a deploy step writes into `globalThis.__DAYBOOK_AUTH_CONFIG__`. When
 * absent, the dev defaults below are used.
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

const DEFAULTS: AppConfig = {
  kratosPublicUrl: "http://localhost:4433",
  kratosReturnTo: "http://localhost:4200/handle-login-return",
  authBackendUrl: "http://localhost:4000/api",
};

export function loadAppConfig(): AppConfig {
  const override = (globalThis as Record<string, unknown>)["__DAYBOOK_AUTH_CONFIG__"] as
    | Partial<AppConfig>
    | undefined;
  return { ...DEFAULTS, ...(override ?? {}) };
}
