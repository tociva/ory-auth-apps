/** Express adapter for the admin authorization policy in `authorize.ts`. */
import type { NextFunction, Request, Response } from "express";
import {
  getAdminOidcClientId,
  getAdminSessionIdleTtlSeconds,
  getAuthzDatabaseUrl,
  getKratosAdminUrl,
} from "../config";
import { authorize, type AdminAuthMode, type AdminIdentity } from "./authorize";
import { adminSessionTokenFrom } from "./session-cookie";

/** Request augmented with the authorized admin identity. */
export interface AuthedRequest extends Request {
  adminIdentity?: AdminIdentity;
  adminEmail?: string;
  adminRole?: string;
  adminSessionId?: string;
  adminAuthMode?: AdminAuthMode;
}

/**
 * Guard middleware: rejects with 401 (no/invalid session) or 403 (authenticated
 * but not an authorized admin), otherwise attaches the identity and continues.
 * Mount this in front of every admin route.
 */
export function requireAdmin() {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const result = await authorize({
      kratosAdminUrl: getKratosAdminUrl(),
      authzDatabaseUrl: getAuthzDatabaseUrl(),
      adminOidcClientId: getAdminOidcClientId(),
      adminSessionIdleTtlSeconds: getAdminSessionIdleTtlSeconds(),
    }, adminSessionTokenFrom(req));

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    req.adminIdentity = result.identity;
    req.adminEmail = result.email;
    req.adminRole = result.role;
    req.adminSessionId = result.session.id;
    req.adminAuthMode = result.authMode;
    next();
  };
}
