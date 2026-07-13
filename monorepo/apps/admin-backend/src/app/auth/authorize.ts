/**
 * Core admin authorization. The Idnest Admin browser never sends OAuth bearer
 * tokens; it sends an opaque HttpOnly BFF session cookie. Each API request
 * re-checks the DB session, Kratos identity state, verified email, and active
 * Idnest client grant.
 */
import {
  getActiveClientAccessGrant,
  getAuthzPool,
  SYSTEM_ADMIN_ROLE,
  touchActiveAdminSession,
  type AdminSession,
  type Db,
} from "@idnest/authz-store";
import {
  isKratosUser,
  type KratosUser,
  type KratosVerifiableAddress,
} from "@idnest/shared-types";

/** Kratos identity with the admin-relevant fields we read for authorization. */
export interface AdminIdentity extends KratosUser {
  state?: string;
  metadata_admin?: { role?: string } | null;
  verifiable_addresses?: KratosVerifiableAddress[];
}

export interface AuthorizeConfig {
  /** Admin Kratos base URL (no trailing slash needed). */
  kratosAdminUrl: string;
  /** Authz DB URL for BFF session + client grant checks. */
  authzDatabaseUrl: string;
  /** Optional DB handle for unit tests. */
  db?: Db;
  /** Expected Hydra client id for the Idnest Admin BFF. */
  adminOidcClientId: string;
  /** Sliding idle timeout to apply when a valid session is used. */
  adminSessionIdleTtlSeconds: number;
}

export type AdminAuthMode = "bff-session";

export type AuthzResult =
  | {
      ok: true;
      identity: AdminIdentity;
      email: string;
      role: string;
      session: AdminSession;
      authMode: AdminAuthMode;
    }
  | { ok: false; status: 401 | 403; error: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate the caller's BFF session and authorize them as an Idnest admin.
 *
 * @param cfg admin session + authorization config
 * @param sessionToken opaque cookie value
 */
export async function authorize(
  cfg: AuthorizeConfig,
  sessionToken?: string,
): Promise<AuthzResult> {
  if (!sessionToken) {
    return { ok: false, status: 401, error: "Missing admin session" };
  }

  const pool = cfg.db ?? getAuthzPool(cfg.authzDatabaseUrl);
  if (!pool) {
    return { ok: false, status: 401, error: "Admin session store is not configured" };
  }

  const session = await touchActiveAdminSession(
    pool,
    sessionToken,
    cfg.adminSessionIdleTtlSeconds,
  );
  if (!session) {
    return { ok: false, status: 401, error: "Invalid or expired admin session" };
  }

  if (session.client_id !== cfg.adminOidcClientId) {
    return { ok: false, status: 403, error: "Invalid admin session client" };
  }

  const identityResult = await loadIdentity(session.identity_id, cfg.kratosAdminUrl);
  if (!identityResult.ok) return identityResult;
  const { identity, email } = identityResult;

  const grant = await getActiveClientAccessGrant(pool, identity.id, cfg.adminOidcClientId);
  if (!grant || grant.role !== SYSTEM_ADMIN_ROLE) {
    return { ok: false, status: 403, error: "Not authorized" };
  }

  return {
    ok: true,
    identity,
    email,
    role: grant.role,
    session,
    authMode: "bff-session",
  };
}

export async function loadIdentity(
  identityId: string,
  kratosAdminUrl: string,
): Promise<
  | { ok: true; identity: AdminIdentity; email: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  let identityRes: Response;
  try {
    identityRes = await fetch(
      `${kratosAdminUrl.replace(/\/+$/, "")}/identities/${encodeURIComponent(identityId)}`,
    );
  } catch {
    return { ok: false, status: 401, error: "Identity lookup failed" };
  }
  if (!identityRes.ok) {
    return { ok: false, status: 401, error: "Identity lookup failed" };
  }

  const identity = (await identityRes.json().catch(() => null)) as AdminIdentity | null;
  if (!identity || !isKratosUser(identity) || identity.id !== identityId) {
    return { ok: false, status: 401, error: "Invalid identity" };
  }
  if (identity.state === "inactive") {
    return { ok: false, status: 403, error: "Identity is inactive" };
  }

  const email = normalizeEmail(String(identity.traits?.email ?? ""));
  if (!email) {
    return { ok: false, status: 403, error: "Identity has no email" };
  }
  if (!hasVerifiedEmail(identity, email)) {
    return { ok: false, status: 403, error: "Email not verified" };
  }

  return { ok: true, identity, email };
}

function hasVerifiedEmail(identity: AdminIdentity, normalizedEmail: string): boolean {
  return (identity.verifiable_addresses ?? []).some(
    (addr) =>
      normalizeEmail(String(addr.value ?? "")) === normalizedEmail &&
      addr.verified === true,
  );
}
