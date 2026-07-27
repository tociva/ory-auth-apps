import { type Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () =>
      import("./auth-page.component").then((module) => module.AuthPageComponent),
  },
  {
    path: "consent",
    loadComponent: () =>
      import("./consent-page.component").then((module) => module.ConsentPageComponent),
  },
  {
    path: "error",
    loadComponent: () =>
      import("./error-page.component").then((module) => module.ErrorPageComponent),
  },
  { path: "**", redirectTo: "error" },
];
