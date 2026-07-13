import { Router, type Request, type Response } from "express";
import { getAdminCsrfSecret } from "./config";
import { completeAdminLogin, logoutAdmin, startAdminLogin } from "./auth/bff";
import { createCsrfToken, requireAdminCsrf } from "./auth/csrf";
import { requireAdmin, type AuthedRequest } from "./auth/middleware";
import {
  createClient,
  deactivateIdentity,
  deleteClient,
  deleteIdentity,
  grantIdentityClientAccess,
  getClient,
  getIdentity,
  listClientIdentityGrants,
  listClients,
  listIdentities,
  listIdentityClientGrants,
  listIdentitySessions,
  revokeIdentityClientAccess,
  revokeIdentitySessions,
  revokeSession,
  setAdminRole,
  updateClient,
  type HandlerResult,
} from "./handlers";

type Handler<T> = (input: T) => Promise<HandlerResult>;

/** Adapt a pure handler into an Express route, selecting its input from the request. */
function adapt<T>(handler: Handler<T>, select: (req: Request) => T) {
  return async (req: Request, res: Response): Promise<void> => {
    const result = await handler(select(req));
    res.status(result.status).json(result.body);
  };
}

const fromBody = (req: Request) => (req.body ?? {}) as Record<string, unknown>;
const idFromParams = (req: Request) => ({ id: req.params.id });

/**
 * Admin API routes sit behind requireAdmin: every request must carry a valid
 * BFF session cookie and pass the authorization policy before any handler runs.
 */
export function createAdminRouter(): Router {
  const router = Router();

  router.get("/auth/login", startAdminLogin);
  router.get("/auth/callback", completeAdminLogin);

  router.use(requireAdmin());

  // --- Authorization probe (reaching here means requireAdmin passed) ---
  router.get("/me", (req: AuthedRequest, res: Response) => {
    res.json({
      email: req.adminEmail,
      role: req.adminRole,
      sessionId: req.adminSessionId,
      identity: req.adminIdentity,
      csrfToken:
        req.adminIdentity && req.adminEmail
          ? createCsrfToken(req.adminIdentity, req.adminEmail, getAdminCsrfSecret())
          : undefined,
    });
  });

  router.use(requireAdminCsrf());

  router.post("/auth/logout", logoutAdmin);

  // --- Identities ---
  router.get(
    "/identities",
    adapt(listIdentities, (req) => ({
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      page_token: typeof req.query.page_token === "string" ? req.query.page_token : undefined,
    })),
  );
  router.get("/identities/:id", adapt(getIdentity, idFromParams));
  router.delete("/identities/:id", adapt(deleteIdentity, idFromParams));
  router.post("/identities/:id/deactivate", adapt(deactivateIdentity, idFromParams));
  router.post(
    "/identities/:id/role",
    adapt(setAdminRole, (req) => ({ id: req.params.id, admin: fromBody(req).admin === true })),
  );
  router.get("/identities/:id/client-access", adapt(listIdentityClientGrants, idFromParams));
  router.post(
    "/identities/:id/client-access/:clientId",
    adapt(grantIdentityClientAccess, (req) => {
      const authed = req as AuthedRequest;
      return {
        id: req.params.id,
        client_id: req.params.clientId,
        role: typeof fromBody(req).role === "string" ? String(fromBody(req).role) : "user",
        granted_by: authed.adminIdentity?.id ?? authed.adminEmail ?? null,
      };
    }),
  );
  router.delete(
    "/identities/:id/client-access/:clientId",
    adapt(revokeIdentityClientAccess, (req) => {
      const authed = req as AuthedRequest;
      return {
        id: req.params.id,
        client_id: req.params.clientId,
        granted_by: authed.adminIdentity?.id ?? authed.adminEmail ?? null,
      };
    }),
  );

  // --- Sessions ---
  router.get("/identities/:id/sessions", adapt(listIdentitySessions, idFromParams));
  router.delete("/identities/:id/sessions", adapt(revokeIdentitySessions, idFromParams));
  router.delete(
    "/sessions/:sessionId",
    adapt(revokeSession, (req) => ({ session_id: req.params.sessionId })),
  );

  // --- OAuth clients ---
  router.get("/clients", adapt(listClients, () => ({})));
  router.get("/clients/:clientId", adapt(getClient, (req) => ({ client_id: req.params.clientId })));
  router.get(
    "/clients/:clientId/identities",
    adapt(listClientIdentityGrants, (req) => ({ client_id: req.params.clientId })),
  );
  router.post("/clients", adapt(createClient, fromBody));
  router.put(
    "/clients/:clientId",
    adapt(updateClient, (req) => ({ ...fromBody(req), client_id: req.params.clientId })),
  );
  router.delete(
    "/clients/:clientId",
    adapt(deleteClient, (req) => ({ client_id: req.params.clientId })),
  );

  return router;
}
