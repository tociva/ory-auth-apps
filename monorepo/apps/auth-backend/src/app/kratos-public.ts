/**
 * Thin server-side client for the Kratos *public* API.
 *
 * In the old SPA these calls ran in the browser with `withCredentials: true`.
 * Server-side we reproduce that by forwarding the incoming request's `Cookie`
 * header (which carries `ory_kratos_session` + the CSRF cookie) on every call.
 * This works because auth-backend is served on the `.idnest.dev` cookie domain,
 * so the browser already sends those cookies to us.
 */
import type { Request } from "express";
import type { KratosFlow } from "@idnest/shared-types";
import { getKratosPublicUrl } from "./config";

export interface KratosWhoami {
  identity: {
    id: string;
    traits?: { name?: string; email?: string; picture?: string; [k: string]: unknown };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface KratosLogoutInit {
  logout_token?: string;
  logout_url?: string;
}

const cookieHeader = (req: Request): string => req.headers.cookie ?? "";

/** Build the browser login URL Kratos should start the flow at. */
export function browserLoginUrl(returnTo: string): string {
  return `${getKratosPublicUrl()}/self-service/login/browser?return_to=${encodeURIComponent(returnTo)}`;
}

/** The action URL the Google sign-in form POSTs to (full-page, browser → Kratos). */
export function loginActionUrl(flowId: string): string {
  return `${getKratosPublicUrl()}/self-service/login?flow=${encodeURIComponent(flowId)}`;
}

/** Fetch a login flow (carries the csrf_token we must render into the form). */
export async function getLoginFlow(flowId: string, req: Request): Promise<KratosFlow> {
  const res = await fetch(
    `${getKratosPublicUrl()}/self-service/login/flows?id=${encodeURIComponent(flowId)}`,
    { headers: { cookie: cookieHeader(req), accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Kratos getLoginFlow failed: ${res.status}`);
  return (await res.json()) as KratosFlow;
}

/** Resolve the current identity from the session cookie. Throws on 401. */
export async function whoami(req: Request): Promise<KratosWhoami> {
  const res = await fetch(`${getKratosPublicUrl()}/sessions/whoami`, {
    headers: { cookie: cookieHeader(req), accept: "application/json" },
  });
  if (res.status === 401) {
    const err = new Error("No active Kratos session") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`Kratos whoami failed: ${res.status}`);
  return (await res.json()) as KratosWhoami;
}

/**
 * whoami with a short server-side retry. After Kratos redirects back post-login
 * the session cookie is normally already set, so this usually succeeds first
 * try; the retry only covers a brief propagation race. This is a fast local
 * loop, not the browser-polling the SPA used to do.
 */
export async function whoamiWithRetry(req: Request, maxRetries = 3): Promise<KratosWhoami> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await whoami(req);
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status !== 401) throw e;
      if (attempt < maxRetries) await delay(150 + attempt * 150);
    }
  }
  throw lastErr;
}

/** Start the Kratos browser logout flow; returns the URL that performs logout. */
export async function initLogout(req: Request): Promise<KratosLogoutInit> {
  const res = await fetch(`${getKratosPublicUrl()}/self-service/logout/browser`, {
    headers: { cookie: cookieHeader(req), accept: "application/json" },
  });
  if (!res.ok) {
    const err = new Error(`Kratos initLogout failed: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as KratosLogoutInit;
}

export function logoutTokenUrl(token: string): string {
  return `${getKratosPublicUrl()}/self-service/logout?token=${encodeURIComponent(token)}`;
}

/**
 * Perform the Kratos logout server-side. Kratos clears `ory_kratos_session` via
 * a `Set-Cookie` on its response; we capture it (redirect: "manual") so the
 * caller can relay it to the browser. Returns the Set-Cookie values, if any.
 */
export async function performLogout(url: string, req: Request): Promise<string[]> {
  const res = await fetch(url, {
    headers: { cookie: cookieHeader(req) },
    redirect: "manual",
  });
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Fetch a Kratos self-service error payload by id (for the error page). */
export async function getKratosError(id: string, req: Request): Promise<unknown> {
  const res = await fetch(
    `${getKratosPublicUrl()}/self-service/errors?id=${encodeURIComponent(id)}`,
    { headers: { cookie: cookieHeader(req), accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Kratos getError failed: ${res.status}`);
  return res.json();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
