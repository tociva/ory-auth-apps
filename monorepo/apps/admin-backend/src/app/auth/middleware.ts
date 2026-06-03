/** Express adapter for the admin authorization policy in `authorize.ts`. */
import type { NextFunction, Request, Response } from "express";
import { getBootstrapAdminEmails, getKratosAdminUrl, getKratosInternalUrl } from "../config";
import { authorize, type AdminIdentity } from "./authorize";

/** Request augmented with the authorized admin identity. */
export interface AuthedRequest extends Request {
  adminIdentity?: AdminIdentity;
  adminEmail?: string;
}

/**
 * Guard middleware: rejects with 401 (no/invalid session) or 403 (authenticated
 * but not an authorized admin), otherwise attaches the identity and continues.
 * Mount this in front of every admin route.
 */
export function requireAdmin() {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const result = await authorize(req.headers.cookie, {
      kratosPublicUrl: getKratosInternalUrl(),
      kratosAdminUrl: getKratosAdminUrl(),
      bootstrapAdminEmails: getBootstrapAdminEmails(),
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    req.adminIdentity = result.identity;
    req.adminEmail = result.email;
    next();
  };
}
