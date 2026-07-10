/**
 * Server-rendered auth pages (login / consent / logout / error), replacing the
 * former Angular `auth-frontend` SPA. Each route does the Hydra/Kratos work
 * server-side and 302-redirects the browser; only `/login` and `/error` render
 * HTML. The privileged Hydra/Kratos admin work is reused from `./handlers`.
 */
import { Router, type Request, type Response } from "express";
import { getAuthBaseUrl, getCorsOrigins } from "./config";
import { getHumanHint, pickSafeDetails } from "./error-utils";
import { acceptConsent, acceptLogin, acceptLogout } from "./handlers";
import * as kratos from "./kratos-public";
import { renderError, renderLogin, renderSettings } from "./views";
import {
  hiddenInputsFromFlow,
  oidcSubmitButtonsFromFlow,
  type FlowHiddenInput,
} from "./views/pages/flow-controls";

function first(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * Allow post-login redirects only to known app origins plus the internal
 * settings handoff. This keeps session-only login `return_to` from becoming an
 * open redirect while still letting /settings require login first.
 */
function isAllowedAppReturnTo(target: string): boolean {
  try {
    return getCorsOrigins().includes(new URL(target).origin);
  } catch {
    return false;
  }
}

function isAllowedAuthReturnTo(target: string): boolean {
  try {
    const url = new URL(target);
    const auth = new URL(getAuthBaseUrl());
    return url.origin === auth.origin && url.pathname === "/settings";
  } catch {
    return false;
  }
}

function isAllowedReturnTo(target: string): boolean {
  return isAllowedAppReturnTo(target) || isAllowedAuthReturnTo(target);
}

function settingsUrl(returnTo: string | undefined): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("return_to", returnTo);
  const query = params.toString();
  return `${getAuthBaseUrl()}/settings${query ? `?${query}` : ""}`;
}

function settingsReturnUrl(returnTo: string | undefined): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("return_to", returnTo);
  const query = params.toString();
  return `${getAuthBaseUrl()}/settings/return${query ? `?${query}` : ""}`;
}

function loginUrl(returnTo: string): string {
  const params = new URLSearchParams({ return_to: returnTo });
  return `/login?${params.toString()}`;
}

function withExtraHiddenInput(inputs: FlowHiddenInput[], name: string, value: string | undefined): FlowHiddenInput[] {
  return value ? [...inputs, { name, value }] : inputs;
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
   *    it server-side, read the csrf_token, and render provider buttons.
   */
  router.get("/login", async (req: Request, res: Response): Promise<void> => {
    const flow = first(req.query["flow"]);
    const loginChallenge = first(req.query["login_challenge"]);
    const loginHint = first(req.query["login_hint"]);

    if (!flow) {
      // Carry both the Hydra `login_challenge` (OAuth flow) and a session-only
      // `return_to` (e.g. the admin console) through Kratos, so /login/return
      // can tell the two cases apart afterwards.
      const postLoginReturnTo = first(req.query["return_to"]);
      const params = new URLSearchParams();
      if (loginChallenge) params.set("login_challenge", loginChallenge);
      if (postLoginReturnTo) params.set("return_to", postLoginReturnTo);
      const query = params.toString();
      const returnTo = `${getAuthBaseUrl()}/login/return${query ? `?${query}` : ""}`;
      res.redirect(kratos.browserLoginUrl(returnTo));
      return;
    }

    try {
      const flowData = await kratos.getLoginFlow(flow, req);
      // Use the flow's own `ui.action` (Kratos builds it from its public
      // base_url, so it's always the correct browser-reachable submit URL)
      // rather than reconstructing it from KRATOS_PUBLIC_URL.
      res.type("html").send(
        renderLogin({
          actionUrl: flowData.ui.action,
          hiddenInputs: withExtraHiddenInput(hiddenInputsFromFlow(flowData), "login_hint", loginHint),
          providers: oidcSubmitButtonsFromFlow(flowData, "Continue with"),
        }),
      );
    } catch {
      sendError(
        res,
        { error: "login_flow_error", error_description: "Could not load the login flow. Please try again." },
        502,
      );
    }
  });

  /**
   * GET /login/return — Kratos redirects here after a successful social login.
   * Resolve the identity (forwarding the session cookie), then accept the Hydra
   * login challenge and redirect on to Hydra. Replaces the SPA's whoami polling.
   */
  router.get("/login/return", async (req: Request, res: Response): Promise<void> => {
    const loginChallenge = first(req.query["login_challenge"]);

    // Session-only login (e.g. the admin console authenticates on the Kratos
    // session cookie, not a Hydra challenge). Kratos has already set the
    // session, so send the browser back to the app's return_to — validated
    // against the origin allowlist to prevent an open redirect.
    if (!loginChallenge) {
      const returnTo = first(req.query["return_to"]);
      if (returnTo && isAllowedReturnTo(returnTo)) {
        res.redirect(returnTo);
        return;
      }
      sendError(res, { error: "missing_login_challenge", error_description: "Missing login_challenge." });
      return;
    }

    try {
      const { identity } = await kratos.whoamiWithRetry(req);
      const result = await acceptLogin({
        login_challenge: loginChallenge,
        subject: identity.id,
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
        sendError(
          res,
          {
            error: "login_unconfirmed",
            error_description: "We couldn't confirm your login. Please try signing in again.",
          },
          401,
        );
        return;
      }
      sendError(
        res,
        { error: "login_return_error", error_description: e instanceof Error ? e.message : "Session error" },
        500,
      );
    }
  });

  /**
   * GET /settings
   *  - No `flow`: require a Kratos session, then start the browser settings flow.
   *  - `flow` present: load the flow and render OIDC link/unlink controls.
   */
  router.get("/settings", async (req: Request, res: Response): Promise<void> => {
    const flow = first(req.query["flow"]);
    const returnTo = first(req.query["return_to"]);

    if (returnTo && !isAllowedAppReturnTo(returnTo)) {
      sendError(
        res,
        {
          error: "invalid_return_to",
          error_description: "The settings return_to URL is not allowed.",
        },
        400,
      );
      return;
    }

    if (!flow) {
      try {
        await kratos.whoami(req);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 401) {
          res.redirect(loginUrl(settingsUrl(returnTo)));
          return;
        }
        sendError(
          res,
          { error: "settings_session_error", error_description: e instanceof Error ? e.message : "Session error" },
          500,
        );
        return;
      }

      res.redirect(kratos.browserSettingsUrl(settingsReturnUrl(returnTo)));
      return;
    }

    try {
      const flowData = await kratos.getSettingsFlow(flow, req);
      res.type("html").send(
        renderSettings({
          actionUrl: flowData.ui.action,
          hiddenInputs: hiddenInputsFromFlow(flowData),
          providers: oidcSubmitButtonsFromFlow(flowData, "Link"),
          returnTo,
        }),
      );
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        res.redirect(loginUrl(settingsUrl(returnTo)));
        return;
      }
      sendError(
        res,
        { error: "settings_flow_error", error_description: e instanceof Error ? e.message : "Settings error" },
        500,
      );
    }
  });

  /**
   * GET /settings/return — Kratos sends the browser here after a successful
   * settings operation. Redirect back to the originating product app.
   */
  router.get("/settings/return", async (req: Request, res: Response): Promise<void> => {
    const returnTo = first(req.query["return_to"]);
    if (returnTo && isAllowedAppReturnTo(returnTo)) {
      res.redirect(returnTo);
      return;
    }

    if (returnTo) {
      sendError(
        res,
        {
          error: "invalid_return_to",
          error_description: "The settings return_to URL is not allowed.",
        },
        400,
      );
      return;
    }

    res.redirect("/settings");
  });

  /**
   * GET /consent — auto-accepts the requested scope/audience (social OIDC, no
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
   * signed back in), then either:
   *  - `logout_challenge` present (Hydra OAuth logout): accept the challenge and
   *    redirect on to Hydra; or
   *  - no challenge (session-only logout, e.g. the admin console): redirect back
   *    to an allowlisted `return_to`.
   * Kratos clears the session cookie via Set-Cookie, which we relay to the browser.
   */
  router.get("/logout", async (req: Request, res: Response): Promise<void> => {
    const logoutChallenge = first(req.query["logout_challenge"]);

    // Best-effort Kratos session termination, common to both paths. A 401 means
    // there's no active session — nothing to terminate.
    try {
      const init = await kratos.initLogout(req);
      // Prefer rebuilding from the token (internal URL) over Kratos's
      // logout_url, which points at the public HTTPS host — keeping this call
      // server-side over the internal address.
      const performUrl =
        init.logout_token ? kratos.logoutTokenUrl(init.logout_token) : init.logout_url ?? null;
      if (performUrl) {
        const setCookies = await kratos.performLogout(performUrl, req);
        for (const c of setCookies) res.append("Set-Cookie", c);
      }
    } catch {
      /* no active Kratos session or init failed */
    }

    // Session-only logout: the Kratos session is now cleared; send the browser
    // back to the app's allowlisted return_to.
    if (!logoutChallenge) {
      const returnTo = first(req.query["return_to"]);
      if (returnTo && isAllowedReturnTo(returnTo)) {
        res.redirect(returnTo);
        return;
      }
      sendError(res, { error: "missing_logout_challenge", error_description: "Missing logout_challenge." });
      return;
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
