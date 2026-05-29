import { Router, type Request, type Response } from "express";
import { requireAdmin } from "./auth/middleware";
import {
  createClient,
  deactivateIdentity,
  deleteClient,
  deleteIdentity,
  getIdentity,
  listClients,
  listIdentities,
  listIdentitySessions,
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
 * All admin routes sit behind requireAdmin: every request must carry a valid
 * Kratos session AND pass the authorization policy before any handler runs.
 */
export function createAdminRouter(): Router {
  const router = Router();
  router.use(requireAdmin());

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

  // --- Sessions ---
  router.get("/identities/:id/sessions", adapt(listIdentitySessions, idFromParams));
  router.delete("/identities/:id/sessions", adapt(revokeIdentitySessions, idFromParams));
  router.delete(
    "/sessions/:sessionId",
    adapt(revokeSession, (req) => ({ session_id: req.params.sessionId })),
  );

  // --- OAuth clients ---
  router.get("/clients", adapt(listClients, () => ({})));
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
