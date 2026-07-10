import { type Routes } from "@angular/router";
import { adminGuard } from "./core/admin.guard";

export const routes: Routes = [
  {
    path: "forbidden",
    loadComponent: () =>
      import("./pages/forbidden/forbidden.component").then((m) => m.ForbiddenComponent),
  },
  {
    path: "",
    canActivate: [adminGuard],
    loadComponent: () => import("./layout/shell.component").then((m) => m.ShellComponent),
    children: [
      {
        path: "identities",
        loadComponent: () =>
          import("./pages/identities/identities.component").then((m) => m.IdentitiesComponent),
      },
      {
        path: "identities/:id",
        loadComponent: () =>
          import("./pages/identity-detail/identity-detail.component").then(
            (m) => m.IdentityDetailComponent,
          ),
      },
      {
        path: "clients",
        loadComponent: () =>
          import("./pages/clients/clients.component").then((m) => m.ClientsComponent),
      },
      {
        path: "clients/new",
        loadComponent: () =>
          import("./pages/client-detail/client-detail.component").then(
            (m) => m.ClientDetailComponent,
          ),
      },
      {
        path: "clients/:clientId",
        loadComponent: () =>
          import("./pages/client-detail/client-detail.component").then(
            (m) => m.ClientDetailComponent,
          ),
      },
      { path: "", pathMatch: "full", redirectTo: "identities" },
    ],
  },
  { path: "**", redirectTo: "" },
];
