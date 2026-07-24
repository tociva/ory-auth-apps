import { Router, type NextFunction, type Request, type Response } from "express";
import { getAdminCsrfSecret } from "./config";
import { completeAdminLogin, logoutAdmin, startAdminLogin } from "./auth/bff";
import { createCsrfToken, requireAdminCsrf } from "./auth/csrf";
import { requireAdmin, type AuthedRequest } from "./auth/middleware";
import {
  archiveBrandConfiguration,
  archivePolicyConfiguration,
  createBrandConfiguration,
  createClient,
  createPolicyConfiguration,
  deactivateIdentity,
  deleteClient,
  deleteClientAuthConfiguration,
  deleteIdentity,
  grantIdentityClientAccess,
  getBrandConfiguration,
  getClient,
  getClientAuthConfiguration,
  getIdentity,
  getPolicyConfiguration,
  listBrandConfigurations,
  listBrandConfigurationHistory,
  listClientAuthConfigurations,
  listClientAuthConfigurationHistory,
  listClientIdentityGrants,
  listClients,
  listIdentities,
  listIdentityClientGrants,
  listIdentitySessions,
  listPolicyConfigurations,
  listPolicyConfigurationHistory,
  putClientAuthConfiguration,
  revokeIdentityClientAccess,
  revokeIdentitySessions,
  revokeSession,
  setAdminRole,
  updateClient,
  updateBrandConfiguration,
  updatePolicyConfiguration,
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
const actorFrom = (req: Request): string | null => {
  const authed = req as AuthedRequest;
  return authed.adminIdentity?.id ?? authed.adminEmail ?? null;
};

function configurationRateLimit(req: Request, res: Response, next: NextFunction): void {
  const windowMs = 60_000;
  const maximum = 60;
  const now = Date.now();
  const authed = req as AuthedRequest;
  const key = authed.adminSessionId ?? req.ip ?? "unknown";
  const existing = configurationBuckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;
  bucket.count += 1;
  configurationBuckets.set(key, bucket);
  if (configurationBuckets.size > 2_000) {
    for (const [candidate, value] of configurationBuckets) {
      if (value.resetAt <= now) configurationBuckets.delete(candidate);
    }
  }
  if (bucket.count > maximum) {
    res.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: "Too many authentication configuration changes" });
    return;
  }
  next();
}

const configurationBuckets = new Map<string, { count: number; resetAt: number }>();

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

  // --- Authentication branding and login policy ---
  router.get("/auth-brands", adapt(listBrandConfigurations, () => ({})));
  router.get("/auth-brands/:id", adapt(getBrandConfiguration, idFromParams));
  router.get(
    "/auth-brands/:id/history",
    adapt(listBrandConfigurationHistory, (req) => ({ id: req.params.id })),
  );
  router.post(
    "/auth-brands",
    configurationRateLimit,
    adapt(createBrandConfiguration, (req) => ({ body: fromBody(req), actor: actorFrom(req) })),
  );
  router.patch(
    "/auth-brands/:id",
    configurationRateLimit,
    adapt(updateBrandConfiguration, (req) => ({
      id: req.params.id,
      body: fromBody(req),
      actor: actorFrom(req),
    })),
  );
  router.delete(
    "/auth-brands/:id",
    configurationRateLimit,
    adapt(archiveBrandConfiguration, (req) => ({
      id: req.params.id,
      actor: actorFrom(req),
    })),
  );

  router.get("/login-policies", adapt(listPolicyConfigurations, () => ({})));
  router.get("/login-policies/:id", adapt(getPolicyConfiguration, idFromParams));
  router.get(
    "/login-policies/:id/history",
    adapt(listPolicyConfigurationHistory, (req) => ({ id: req.params.id })),
  );
  router.post(
    "/login-policies",
    configurationRateLimit,
    adapt(createPolicyConfiguration, (req) => ({ body: fromBody(req), actor: actorFrom(req) })),
  );
  router.patch(
    "/login-policies/:id",
    configurationRateLimit,
    adapt(updatePolicyConfiguration, (req) => ({
      id: req.params.id,
      body: fromBody(req),
      actor: actorFrom(req),
    })),
  );
  router.delete(
    "/login-policies/:id",
    configurationRateLimit,
    adapt(archivePolicyConfiguration, (req) => ({
      id: req.params.id,
      actor: actorFrom(req),
    })),
  );

  router.get("/client-auth-configs", adapt(listClientAuthConfigurations, () => ({})));
  router.get(
    "/client-auth-configs/:clientId",
    adapt(getClientAuthConfiguration, (req) => ({ clientId: req.params.clientId })),
  );
  router.get(
    "/client-auth-configs/:clientId/history",
    adapt(listClientAuthConfigurationHistory, (req) => ({
      clientId: req.params.clientId,
    })),
  );
  router.put(
    "/client-auth-configs/:clientId",
    configurationRateLimit,
    adapt(putClientAuthConfiguration, (req) => ({
      clientId: req.params.clientId,
      body: fromBody(req),
      actor: actorFrom(req),
    })),
  );
  router.delete(
    "/client-auth-configs/:clientId",
    configurationRateLimit,
    adapt(deleteClientAuthConfiguration, (req) => ({
      clientId: req.params.clientId,
      actor: actorFrom(req),
    })),
  );

  return router;
}
