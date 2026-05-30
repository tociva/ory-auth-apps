/**
 * Server-rendered auth pages (login / consent / logout / error), replacing the
 * former Angular `auth-frontend` SPA. Each route does the Hydra/Kratos work
 * server-side and 302-redirects the browser; only `/login` and `/error` render
 * HTML. The privileged Hydra/Kratos admin work is reused from `./handlers`.
 */
import { Router, type Request, type Response } from "express";
import { getCsrfToken } from "@idnest/shared-types";
import { getAuthBaseUrl } from "./config";
import { getHumanHint, pickSafeDetails } from "./error-utils";
import { acceptConsent, acceptLogin, acceptLogout } from "./handlers";
import * as kratos from "./kratos-public";
import { renderError } from "./views/error";
import { renderLogin } from "./views/login";

function first(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** Render the error page from an arbitrary error payload. */
function sendError(res: Response, payload: unknown, status = 400): void {
  res.status(status).type("html").send(
    renderError({ safeDetails: pickSafeDetails(payload), hint: getHumanHint(payload) }),
  );
}

export function createPagesRouter(): Router {
  const router = Router();

  /**
   * GET /login
   *  - No `flow`: start the Kratos browser login flow, telling it to send the
   *    browser back to /login/return (carrying the login_challenge) after login.
   *  - `flow` present: Kratos has bounced the browser here with a flow id; load
   *    it server-side, read the csrf_token, and render the Google button.
   */
  router.get("/login", async (req: Request, res: Response): Promise<void> => {
    const flow = first(req.query["flow"]);
    const loginChallenge = first(req.query["login_challenge"]);
    const loginHint = first(req.query["login_hint"]);

    if (!flow) {
      const returnTo =
        `${getAuthBaseUrl()}/login/return` +
        (loginChallenge ? `?login_challenge=${encodeURIComponent(loginChallenge)}` : "");
      res.redirect(kratos.browserLoginUrl(returnTo));
      return;
    }

    try {
      const flowData = await kratos.getLoginFlow(flow, req);
      res.type("html").send(
        renderLogin({
          actionUrl: kratos.loginActionUrl(flow),
          csrfToken: getCsrfToken(flowData),
          loginHint,
        }),
      );
    } catch {
      sendError(res, { error: "login_flow_error", error_description: "Could not load the login flow. Please try again." }, 502);
    }
  });

  /**
   * GET /login/return — Kratos redirects here after a successful Google login.
   * Resolve the identity (forwarding the session cookie), then accept the Hydra
   * login challenge and redirect on to Hydra. Replaces the SPA's whoami polling.
   */
  router.get("/login/return", async (req: Request, res: Response): Promise<void> => {
    const loginChallenge = first(req.query["login_challenge"]);
    if (!loginChallenge) {
      sendError(res, { error: "missing_login_challenge", error_description: "Missing login_challenge." });
      return;
    }

    try {
      const { identity } = await kratos.whoamiWithRetry(req);
      const result = await acceptLogin({
        login_challenge: loginChallenge,
        subject: identity.id,
        id_token: {
          name: identity.traits?.name,
          email: identity.traits?.email,
          picture: identity.traits?.picture,
        },
      });
      const redirectTo = (result.body as { redirect_to?: string }).redirect_to;
      if (result.status === 200 && redirectTo) {
        res.redirect(redirectTo);
        return;
      }
      sendError(res, result.body, result.status);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        sendError(res, { error: "login_unconfirmed", error_description: "We couldn't confirm your login. Please try signing in again." }, 401);
        return;
      }
      sendError(res, { error: "login_return_error", error_description: e instanceof Error ? e.message : "Session error" }, 500);
    }
  });

  /**
   * GET /consent — auto-accepts the requested scope/audience (Google-only, no
   * interactive consent screen), then redirects back to Hydra.
   */
  router.get("/consent", async (req: Request, res: Response): Promise<void> => {
    const consentChallenge = first(req.query["consent_challenge"]);
    if (!consentChallenge) {
      sendError(res, { error: "missing_consent_challenge", error_description: "No consent_challenge provided." });
      return;
    }

    const result = await acceptConsent({ consent_challenge: consentChallenge });
    const redirectTo = (result.body as { redirect_to?: string }).redirect_to;
    if (result.status === 200 && redirectTo) {
      res.redirect(redirectTo);
      return;
    }
    sendError(res, result.body, result.status);
  });

  /**
   * GET /logout — terminate the Kratos session first (so the user isn't silently
   * signed back in), then accept the Hydra logout challenge. Kratos clears the
   * session cookie via Set-Cookie, which we relay to the browser.
   */
  router.get("/logout", async (req: Request, res: Response): Promise<void> => {
    const logoutChallenge = first(req.query["logout_challenge"]);
    if (!logoutChallenge) {
      sendError(res, { error: "missing_logout_challenge", error_description: "Missing logout_challenge." });
      return;
    }

    // Best-effort Kratos session termination. A 401 means there's no active
    // session — nothing to terminate, so we proceed to Hydra.
    try {
      const init = await kratos.initLogout(req);
      const performUrl =
        init.logout_url ?? (init.logout_token ? kratos.logoutTokenUrl(init.logout_token) : null);
      if (performUrl) {
        const setCookies = await kratos.performLogout(performUrl, req);
        for (const c of setCookies) res.append("Set-Cookie", c);
      }
    } catch {
      /* no active Kratos session or init failed; continue to Hydra */
    }

    const result = await acceptLogout({ logout_challenge: logoutChallenge });
    const redirectTo = (result.body as { redirect_to?: string }).redirect_to;
    if (result.status === 200 && redirectTo) {
      res.redirect(redirectTo);
      return;
    }
    sendError(res, result.body, result.status);
  });

  /**
   * GET /error — Hydra's configured error sink. Shows a safe, whitelisted view
   * of the error, enriching from Kratos's error store when an `id` is present.
   */
  router.get("/error", async (req: Request, res: Response): Promise<void> => {
    const id = first(req.query["id"]);
    if (id) {
      try {
        const kratosErr = await kratos.getKratosError(id, req);
        sendError(res, kratosErr, 400);
        return;
      } catch {
        /* fall through to query-param based error */
      }
    }

    const payload = {
      error: first(req.query["error"]) ?? "unknown_error",
      error_description: first(req.query["error_description"]),
      error_hint: first(req.query["error_hint"]),
    };
    sendError(res, payload, 400);
  });

  return router;
}
