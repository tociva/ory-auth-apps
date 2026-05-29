import { type ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { createTheme, defaultThemePreset, provideTailngTheme } from "@tailng-ui/theme";
import { routes } from "./app.routes";
import { APP_CONFIG, loadAppConfig } from "./core/app-config";

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

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: APP_CONFIG, useValue: loadAppConfig() },
    provideTailngTheme({ theme: idnestTheme }),
  ],
};
