import { Router, type Request, type Response } from "express";
import {
  acceptConsent,
  acceptLogin,
  acceptLogout,
  rejectConsent,
  type HandlerResult,
} from "./handlers";

type Handler<T> = (input: T) => Promise<HandlerResult>;

/** Adapt a pure handler into an Express route, forwarding the JSON body. */
function adapt<T>(handler: Handler<T>) {
  return async (req: Request, res: Response): Promise<void> => {
    const result = await handler((req.body ?? {}) as T);
    res.status(result.status).json(result.body);
  };
}

/** Mirrors the original Next.js `/api/hydra/*` proxy routes. */
export function createHydraRouter(): Router {
  const router = Router();
  router.post("/accept-login", adapt(acceptLogin));
  router.post("/accept-consent", adapt(acceptConsent));
  router.post("/reject-consent", adapt(rejectConsent));
  router.post("/accept-logout", adapt(acceptLogout));
  return router;
}
