import { bootstrapApplication } from "@angular/platform-browser";
import { createAppConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { type AdminConfig, DEFAULT_ADMIN_CONFIG } from "./app/core/admin-config";

/**
 * Build-once / deploy-many: the runtime config is fetched from
 * `public/config.json` before the app bootstraps, then provided to Angular.
 * The URL is resolved against `<base href>` so it works on deep routes too.
 * Falls back to dev defaults if the file is missing or unreadable.
 */
async function loadRuntimeConfig(): Promise<AdminConfig> {
  try {
    const res = await fetch(new URL("config.json", document.baseURI), { cache: "no-store" });
    if (!res.ok) return DEFAULT_ADMIN_CONFIG;
    const override = (await res.json()) as Partial<AdminConfig>;
    return {
      ...DEFAULT_ADMIN_CONFIG,
      ...override,
    };
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}

void loadRuntimeConfig().then((config) =>
  bootstrapApplication(AppComponent, createAppConfig(config)).catch((err) => console.error(err)),
);
