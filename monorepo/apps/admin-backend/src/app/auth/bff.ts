import { randomBytes, createHash } from "node:crypto";
import type { Request, Response } from "express";
import {
  bootstrapFirstSystemAdmin,
  createAdminOAuthTransaction,
  createAdminSession,
  consumeAdminOAuthTransaction,
  getActiveClientAccessGrant,
  getAuthzPool,
  revokeAdminSession,
  SYSTEM_ADMIN_ROLE,
} from "@idnest/authz-store";
import {
  getAdminBootstrapEmails,
  getAdminOAuthTransactionTtlSeconds,
  getAdminOidcAudience,
  getAdminOidcAuthority,
  getAdminOidcClientId,
  getAdminOidcClientSecret,
  getAdminOidcScope,
  getAdminOidcTokenUrl,
  getAdminPublicOrigin,
  getAdminRedirectUri,
  getAdminSessionIdleTtlSeconds,
  getAdminSessionTtlSeconds,
  getAuthzDatabaseUrl,
  getHydraAdminUrl,
  getKratosAdminUrl,
} from "../config";
import { loadIdentity } from "./authorize";
import { clearAdminSessionCookie, setAdminSessionCookie } from "./session-cookie";
import type { AuthedRequest } from "./middleware";

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
}

interface HydraIntrospection {
  active?: boolean;
  sub?: string;
  client_id?: string;
  aud?: string | string[];
  audience?: string | string[];
  token_type?: string;
  token_use?: string;
}

export async function startAdminLogin(req: Request, res: Response): Promise<void> {
  try {
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(24);
    const codeVerifier = randomBase64Url(48);
    const codeChallenge = sha256Base64Url(codeVerifier);
    const returnTo = safeReturnTo(typeof req.query.return_to === "string" ? req.query.return_to : undefined);
    const pool = getAuthzPool(getAuthzDatabaseUrl());
    if (!pool) {
      res.status(500).json({ error: "Admin session store is not configured" });
      return;
    }

    await createAdminOAuthTransaction(pool, {
      state,
      nonce,
      codeVerifier,
      returnTo,
      ttlSeconds: getAdminOAuthTransactionTtlSeconds(),
      requestIp: requestIp(req),
      userAgent: req.get("user-agent") ?? null,
    });

    const authorizeUrl = new URL("oauth2/auth", normalizedAuthority());
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: getAdminOidcClientId(),
      redirect_uri: getAdminRedirectUri(),
      scope: getAdminOidcScope(),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      audience: getAdminOidcAudience(),
      prompt: "login",
    }).toString();
    res.redirect(authorizeUrl.toString());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Admin login failed" });
  }
}

export async function completeAdminLogin(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    res.status(400).send("Missing OAuth callback parameters");
    return;
  }

  const pool = getAuthzPool(getAuthzDatabaseUrl());
  if (!pool) {
    res.status(500).send("Admin session store is not configured");
    return;
  }

  let transaction;
  try {
    transaction = await consumeAdminOAuthTransaction(pool, state);
  } catch {
    res.status(500).send("OAuth state lookup failed");
    return;
  }
  if (!transaction) {
    res.status(400).send("Invalid or expired OAuth state");
    return;
  }

  try {
    const token = await exchangeCode(code, transaction.code_verifier);
    if (!token.access_token) {
      res.status(502).send("OAuth token exchange failed");
      return;
    }
    if (token.id_token) {
      const tokenNonce = readJwtClaim(token.id_token, "nonce");
      if (tokenNonce && tokenNonce !== transaction.nonce) {
        res.status(401).send("Invalid OIDC nonce");
        return;
      }
    }

    const introspection = await introspectToken(token.access_token);
    const invalidToken = validateAdminToken(introspection);
    if (invalidToken) {
      res.status(invalidToken.status).send(invalidToken.error);
      return;
    }

    const subject = introspection.sub;
    if (!subject) {
      res.status(401).send("Inactive or invalid access token");
      return;
    }
    const identityResult = await loadIdentity(subject, getKratosAdminUrl());
    if (!identityResult.ok) {
      res.status(identityResult.status).send(identityResult.error);
      return;
    }

    let grant = await getActiveClientAccessGrant(
      pool,
      identityResult.identity.id,
      getAdminOidcClientId(),
    );
    if (
      (!grant || grant.role !== SYSTEM_ADMIN_ROLE) &&
      getAdminBootstrapEmails().includes(identityResult.email)
    ) {
      const bootstrappedGrant = await bootstrapFirstSystemAdmin(pool, {
        identityId: identityResult.identity.id,
        clientId: getAdminOidcClientId(),
        grantedBy: "bootstrap-email",
      });
      grant = bootstrappedGrant ?? grant;
    }
    if (!grant || grant.role !== SYSTEM_ADMIN_ROLE) {
      res.status(403).send("Not authorized");
      return;
    }

    const sessionToken = randomBase64Url(32);
    await createAdminSession(pool, {
      token: sessionToken,
      identityId: identityResult.identity.id,
      clientId: getAdminOidcClientId(),
      role: grant.role,
      email: identityResult.email,
      ttlSeconds: getAdminSessionTtlSeconds(),
      idleTtlSeconds: getAdminSessionIdleTtlSeconds(),
      requestIp: requestIp(req),
      userAgent: req.get("user-agent") ?? null,
    });

    setAdminSessionCookie(res, sessionToken, getAdminSessionTtlSeconds());
    res.redirect(transaction.return_to || "/");
  } catch (err) {
    res.status(502).send(err instanceof Error ? err.message : "Admin login failed");
  }
}

export async function logoutAdmin(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const pool = getAuthzPool(getAuthzDatabaseUrl());
    if (pool && req.adminSessionId) {
      await revokeAdminSession(pool, {
        sessionId: req.adminSessionId,
        revokedBy: req.adminIdentity?.id ?? "admin_logout",
      });
    }
  } catch {
    // Browser logout should still clear the HttpOnly cookie if DB revocation fails.
  } finally {
    clearAdminSessionCookie(res);
  }
  res.json({ redirect_to: "/auth/logout" });
}

async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const clientSecret = getAdminOidcClientSecret();
  if (!clientSecret) throw new Error("ADMIN_OIDC_CLIENT_SECRET is required");
  const res = await fetch(getAdminOidcTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${getAdminOidcClientId()}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getAdminRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });
  const body = (await res.json().catch(() => null)) as TokenResponse | null;
  if (!res.ok || !body?.access_token) {
    throw new Error("OAuth token exchange failed");
  }
  return body;
}

async function introspectToken(accessToken: string): Promise<HydraIntrospection> {
  const res = await fetch(`${getHydraAdminUrl().replace(/\/+$/, "")}/admin/oauth2/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  });
  if (!res.ok) throw new Error("Token introspection failed");
  return (await res.json()) as HydraIntrospection;
}

function validateAdminToken(
  token: HydraIntrospection,
): { status: 401 | 403; error: string } | null {
  if (!token.active || !token.sub) {
    return { status: 401, error: "Inactive or invalid access token" };
  }
  if (token.client_id !== getAdminOidcClientId()) {
    return { status: 403, error: "Invalid token client" };
  }
  if (!hasAudience(token, getAdminOidcAudience())) {
    return { status: 403, error: "Invalid token audience" };
  }
  if (!isAccessToken(token)) {
    return { status: 403, error: "Invalid token use" };
  }
  return null;
}

function hasAudience(token: HydraIntrospection, expected: string): boolean {
  const audience = token.aud ?? token.audience;
  if (Array.isArray(audience)) return audience.includes(expected);
  return audience === expected;
}

function isAccessToken(token: HydraIntrospection): boolean {
  const value = (token.token_use ?? token.token_type ?? "access_token").toLowerCase();
  return value === "access_token" || value === "bearer";
}

function normalizedAuthority(): string {
  return getAdminOidcAuthority().replace(/\/?$/, "/");
}

function safeReturnTo(value: string | undefined): string {
  if (!value) return "/";
  try {
    const parsed = new URL(value, getAdminPublicOrigin());
    if (parsed.origin !== getAdminPublicOrigin()) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

function randomBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function readJwtClaim(token: string, claim: string): string | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof data[claim] === "string" ? data[claim] : null;
  } catch {
    return null;
  }
}

function requestIp(req: Request): string | null {
  const forwarded = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || null;
}
