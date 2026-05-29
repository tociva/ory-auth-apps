import { type ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { createTheme, defaultThemePreset, provideTailngTheme } from "@tailng-ui/theme";
import { routes } from "./app.routes";
import { ADMIN_CONFIG, type AdminConfig } from "./core/admin-config";

const idnestTheme = createTheme(defaultThemePreset, {
  tokens: {
    semantic: {
      accent: {
        brand: "#367588",
        brandHover: "#2c606f",
      },
      focus: {
        ring: "#367588",
      },
    },
  },
});

/** Build the application config with the runtime config loaded in `main.ts`. */
export function createAppConfig(config: AdminConfig): ApplicationConfig {
  return {
    providers: [
      provideRouter(routes),
      provideHttpClient(withFetch()),
      { provide: ADMIN_CONFIG, useValue: config },
      provideTailngTheme({ theme: idnestTheme }),
    ],
  };
}
