import { type Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./pages/login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "handle-login-return",
    loadComponent: () =>
      import("./pages/handle-login-return/handle-login-return.component").then(
        (m) => m.HandleLoginReturnComponent,
      ),
  },
  {
    path: "consent",
    loadComponent: () =>
      import("./pages/consent/consent.component").then((m) => m.ConsentComponent),
  },
  {
    path: "logout",
    loadComponent: () => import("./pages/logout/logout.component").then((m) => m.LogoutComponent),
  },
  {
    path: "error",
    loadComponent: () => import("./pages/error/error.component").then((m) => m.ErrorComponent),
  },
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "**", redirectTo: "login" },
];
