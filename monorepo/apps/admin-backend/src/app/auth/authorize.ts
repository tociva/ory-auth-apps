/**
 * Core admin authorization (Phase 3.3). Framework-agnostic so it can be unit
 * tested without Express.
 *
 * Policy, enforced on EVERY admin request:
 *   1. The caller must present a valid, active Kratos session (via `whoami`).
 *   2. Their primary email must be verified (Google `email_verified`, surfaced
 *      by Kratos as a verified verifiable_address).
 *   3. They must be authorized — either in the server-side bootstrap allowlist
 *      or carry `metadata_admin.role === "admin"` (the runtime source of truth,
 *      settable only via the admin API).
 *
 * Emails are normalized (trim + lowercase) before any comparison. UI hiding is
 * never treated as a security boundary; this check is the boundary.
 */
import { isKratosUser, type KratosUser } from "@idnest/shared-types";

/** A Kratos verifiable address (email) as returned by the identity/session API. */
export interface KratosVerifiableAddress {
  value?: string;
  verified?: boolean;
  via?: string;
}

/** Kratos identity with the admin-relevant fields we read for authorization. */
export interface AdminIdentity extends KratosUser {
  metadata_admin?: { role?: string } | null;
  verifiable_addresses?: KratosVerifiableAddress[];
}

/** The subset of the Kratos `whoami` session response we rely on. */
export interface KratosSession {
  active?: boolean;
  identity?: AdminIdentity;
}

export interface AuthorizeConfig {
  /** Public Kratos base URL (no trailing slash needed). */
  kratosPublicUrl: string;
  /** Admin Kratos base URL (no trailing slash needed). */
  kratosAdminUrl: string;
  /** Bootstrap admin emails, already normalized (lowercase + trimmed). */
  bootstrapAdminEmails: string[];
}

export type AuthzResult =
  | { ok: true; identity: AdminIdentity; email: string }
  | { ok: false; status: 401 | 403; error: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate the caller's session and authorize them as an admin.
 *
 * @param cookieHeader the raw `Cookie` header forwarded from the browser
 * @param cfg          Kratos public URL + bootstrap allowlist
 */
export async function authorize(
  cookieHeader: string | undefined,
  cfg: AuthorizeConfig,
): Promise<AuthzResult> {
  if (!cookieHeader) {
    return { ok: false, status: 401, error: "No session cookie" };
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.kratosPublicUrl.replace(/\/+$/, "")}/sessions/whoami`, {
      headers: { cookie: cookieHeader },
    });
  } catch {
    return { ok: false, status: 401, error: "Session check failed" };
  }

  // 401 from Kratos means no/expired session.
  if (res.status === 401) {
    return { ok: false, status: 401, error: "No valid session" };
  }
  if (!res.ok) {
    return { ok: false, status: 401, error: "Session check failed" };
  }

  const session = (await res.json().catch(() => null)) as KratosSession | null;
  if (!session?.active || !isKratosUser(session.identity)) {
    return { ok: false, status: 401, error: "Inactive or invalid session" };
  }

  const sessionIdentity = session.identity;
  let identityRes: Response;
  try {
    identityRes = await fetch(
      `${cfg.kratosAdminUrl.replace(/\/+$/, "")}/identities/${encodeURIComponent(sessionIdentity.id)}`,
    );
  } catch {
    return { ok: false, status: 401, error: "Identity lookup failed" };
  }
  if (!identityRes.ok) {
    return { ok: false, status: 401, error: "Identity lookup failed" };
  }

  const identity = (await identityRes.json().catch(() => null)) as AdminIdentity | null;
  if (!isKratosUser(identity) || identity.id !== sessionIdentity.id) {
    return { ok: false, status: 401, error: "Invalid identity" };
  }

  const email = normalizeEmail(String(identity.traits?.email ?? ""));
  if (!email) {
    return { ok: false, status: 403, error: "Identity has no email" };
  }

  // Require a verified email matching the identity's primary email.
  const emailVerified = (identity.verifiable_addresses ?? []).some(
    (addr) => normalizeEmail(String(addr.value ?? "")) === email && addr.verified === true,
  );
  if (!emailVerified) {
    return { ok: false, status: 403, error: "Email not verified" };
  }

  const isBootstrapAdmin = cfg.bootstrapAdminEmails.includes(email);
  const isRoleAdmin = identity.metadata_admin?.role === "admin";
  if (!isBootstrapAdmin && !isRoleAdmin) {
    return { ok: false, status: 403, error: "Not authorized" };
  }

  return { ok: true, identity, email };
}
