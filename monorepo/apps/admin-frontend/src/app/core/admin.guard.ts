import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import type { HttpErrorResponse } from "@angular/common/http";
import { AdminApiService } from "./admin-api.service";
import { ADMIN_CONFIG } from "./admin-config";

/**
 * Route guard backed by the real server-side authorization. It calls
 * `GET /api/admin/me` (which runs admin-backend's `requireAdmin`):
 *   - 200 → authorized, allow navigation.
 *   - 403 → authenticated but not an admin → /forbidden.
 *   - 401 / other → not signed in → bounce to the auth login page.
 *
 * The guard is a UX convenience; the actual boundary is admin-backend, which
 * re-checks every request.
 */
export const adminGuard: CanActivateFn = async () => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  const config = inject(ADMIN_CONFIG);

  try {
    await api.me();
    return true;
  } catch (e) {
    const status = (e as HttpErrorResponse)?.status;
    if (status === 403) {
      return router.parseUrl("/forbidden");
    }
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${config.authLoginUrl}?return_to=${returnTo}`;
    return false;
  }
};
