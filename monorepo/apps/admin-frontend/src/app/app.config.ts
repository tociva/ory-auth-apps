import { APP_INITIALIZER, type ApplicationConfig, inject } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideTngIcons } from "@tailng-ui/icons";
import { routes } from "./app.routes";
import { AdminAuthService } from "./core/admin-auth.service";
import { ADMIN_CONFIG, type AdminConfig } from "./core/admin-config";
import { AppThemeService } from "./core/theme/app-theme.service";

/** Build the application config with the runtime config loaded in `main.ts`. */
export function createAppConfig(config: AdminConfig): ApplicationConfig {
  return {
    providers: [
      provideRouter(routes),
      provideHttpClient(withFetch()),
      { provide: ADMIN_CONFIG, useValue: config },
      provideTngIcons(),
      // Eagerly instantiate AppThemeService so the theme effect runs before
      // the first component renders and avoids a flash of wrong theme.
      {
        provide: APP_INITIALIZER,
        useFactory: () => {
          inject(AppThemeService); // side-effect: registers the theme effect
          inject(AdminAuthService).initialize();
          return () => undefined;
        },
        multi: true,
      },
    ],
  };
}
