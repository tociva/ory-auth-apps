import { type ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { routes } from "./app.routes";
import { APP_CONFIG, loadAppConfig } from "./core/app-config";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: APP_CONFIG, useValue: loadAppConfig() },
  ],
};
