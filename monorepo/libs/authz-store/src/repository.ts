import { createHash } from "node:crypto";
import type { Db } from "./db";

export const SYSTEM_ADMIN_ROLE = "system-admin";

export interface ClientAccessGrant {
  id: string;
  identity_id: string;
  client_id: string;
  role: string;
  granted_by?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

export interface ConsentApproval {
  id: string;
  identity_id: string;
  client_id: string;
  scope_hash: string;
  audience_hash: string;
  trust_tier: string;
  consent_version: number;
  approved_at: string;
  revoked_at?: string | null;
}

export interface AdminSession {
  id: string;
  identity_id: string;
  client_id: string;
  role: string;
  email?: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  idle_expires_at: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  request_ip?: string | null;
  user_agent?: string | null;
}

export interface AdminOAuthTransaction {
  id: string;
  nonce: string;
  code_verifier: string;
  return_to: string;
  created_at: string;
  expires_at: string;
  used_at?: string | null;
  request_ip?: string | null;
  user_agent?: string | null;
}

export interface ConsentKey {
  identityId: string;
  clientId: string;
  scopes: string[];
  audiences: string[];
  trustTier: string;
  consentVersion: number;
}

export type ConsentAuditType =
  | "prompt"
  | "accept"
  | "auto_accept"
  | "reject"
  | "access_denied"
  | "observe_missing_grant";

export function canonicalList(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort();
}

export function listHash(values: string[]): string {
  return createHash("sha256").update(canonicalList(values).join("\n")).digest("hex");
}

export function opaqueHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function hasActiveClientAccess(
  db: Db,
  identityId: string,
  clientId: string,
): Promise<boolean> {
  const res = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM client_access_grants
      WHERE identity_id = $1 AND client_id = $2 AND revoked_at IS NULL
    ) AS exists`,
    [identityId, clientId],
  );
  return res.rows[0]?.exists === true;
}

export async function getActiveClientAccessGrant(
  db: Db,
  identityId: string,
  clientId: string,
): Promise<ClientAccessGrant | null> {
  const res = await db.query<ClientAccessGrant>(
    `SELECT id::text, identity_id, client_id, role, granted_by, created_at::text, revoked_at::text
     FROM client_access_grants
     WHERE identity_id = $1 AND client_id = $2 AND revoked_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [identityId, clientId],
  );
  return res.rows[0] ?? null;
}

export async function listIdentityClientAccess(
  db: Db,
  identityId: string,
): Promise<ClientAccessGrant[]> {
  const res = await db.query<ClientAccessGrant>(
    `SELECT id::text, identity_id, client_id, role, granted_by, created_at::text, revoked_at::text
     FROM client_access_grants
     WHERE identity_id = $1 AND revoked_at IS NULL
     ORDER BY client_id`,
    [identityId],
  );
  return res.rows;
}

export async function listClientIdentityAccess(
  db: Db,
  clientId: string,
): Promise<ClientAccessGrant[]> {
  const res = await db.query<ClientAccessGrant>(
    `SELECT id::text, identity_id, client_id, role, granted_by, created_at::text, revoked_at::text
     FROM client_access_grants
     WHERE client_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [clientId],
  );
  return res.rows;
}

export async function grantClientAccess(
  db: Db,
  input: { identityId: string; clientId: string; role?: string; grantedBy?: string | null },
): Promise<ClientAccessGrant> {
  const res = await db.query<ClientAccessGrant>(
    `INSERT INTO client_access_grants(identity_id, client_id, role, granted_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (identity_id, client_id) WHERE revoked_at IS NULL
     DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by
     RETURNING id::text, identity_id, client_id, role, granted_by, created_at::text, revoked_at::text`,
    [input.identityId, input.clientId, input.role ?? "user", input.grantedBy ?? null],
  );
  return res.rows[0];
}

export async function revokeClientAccess(
  db: Db,
  input: { identityId: string; clientId: string; revokedBy?: string | null },
): Promise<boolean> {
  const res = await db.query(
    `UPDATE client_access_grants
     SET revoked_at = now(), revoked_by = $3
     WHERE identity_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
    [input.identityId, input.clientId, input.revokedBy ?? null],
  );
  await revokeConsentApprovals(db, input.identityId, input.clientId);
  await revokeAdminSessionsForIdentityClient(db, {
    identityId: input.identityId,
    clientId: input.clientId,
    revokedBy: input.revokedBy ?? "client_access_revoked",
  });
  return (res.rowCount ?? 0) > 0;
}

export async function createAdminOAuthTransaction(
  db: Db,
  input: {
    state: string;
    nonce: string;
    codeVerifier: string;
    returnTo: string;
    ttlSeconds: number;
    requestIp?: string | null;
    userAgent?: string | null;
  },
): Promise<AdminOAuthTransaction> {
  const res = await db.query<AdminOAuthTransaction>(
    `INSERT INTO admin_oauth_transactions(
       state_hash, nonce, code_verifier, return_to, expires_at, request_ip, user_agent
     )
     VALUES ($1, $2, $3, $4, now() + ($5::int * interval '1 second'), $6, $7)
     RETURNING id::text, nonce, code_verifier, return_to, created_at::text,
               expires_at::text, used_at::text, request_ip, user_agent`,
    [
      opaqueHash(input.state),
      input.nonce,
      input.codeVerifier,
      input.returnTo,
      input.ttlSeconds,
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );
  return res.rows[0];
}

export async function consumeAdminOAuthTransaction(
  db: Db,
  state: string,
): Promise<AdminOAuthTransaction | null> {
  const res = await db.query<AdminOAuthTransaction>(
    `UPDATE admin_oauth_transactions
     SET used_at = now()
     WHERE state_hash = $1
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING id::text, nonce, code_verifier, return_to, created_at::text,
               expires_at::text, used_at::text, request_ip, user_agent`,
    [opaqueHash(state)],
  );
  return res.rows[0] ?? null;
}

export async function createAdminSession(
  db: Db,
  input: {
    token: string;
    identityId: string;
    clientId: string;
    role: string;
    email?: string | null;
    ttlSeconds: number;
    idleTtlSeconds: number;
    requestIp?: string | null;
    userAgent?: string | null;
  },
): Promise<AdminSession> {
  const res = await db.query<AdminSession>(
    `INSERT INTO admin_sessions(
       token_hash, identity_id, client_id, role, email, expires_at, idle_expires_at,
       request_ip, user_agent
     )
     VALUES (
       $1, $2, $3, $4, $5,
       now() + ($6::int * interval '1 second'),
       LEAST(
         now() + ($6::int * interval '1 second'),
         now() + ($7::int * interval '1 second')
       ),
       $8, $9
     )
     RETURNING id::text, identity_id, client_id, role, email, created_at::text,
               last_seen_at::text, expires_at::text, idle_expires_at::text,
               revoked_at::text, revoked_by, request_ip, user_agent`,
    [
      opaqueHash(input.token),
      input.identityId,
      input.clientId,
      input.role,
      input.email ?? null,
      input.ttlSeconds,
      input.idleTtlSeconds,
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );
  return res.rows[0];
}

export async function touchActiveAdminSession(
  db: Db,
  token: string,
  idleTtlSeconds: number,
): Promise<AdminSession | null> {
  const res = await db.query<AdminSession>(
    `UPDATE admin_sessions
     SET last_seen_at = now(),
         idle_expires_at = LEAST(expires_at, now() + ($2::int * interval '1 second'))
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()
       AND idle_expires_at > now()
     RETURNING id::text, identity_id, client_id, role, email, created_at::text,
               last_seen_at::text, expires_at::text, idle_expires_at::text,
               revoked_at::text, revoked_by, request_ip, user_agent`,
    [opaqueHash(token), idleTtlSeconds],
  );
  return res.rows[0] ?? null;
}

export async function revokeAdminSession(
  db: Db,
  input: { sessionId: string; revokedBy?: string | null },
): Promise<boolean> {
  const res = await db.query(
    `UPDATE admin_sessions
     SET revoked_at = now(), revoked_by = $2
     WHERE id = $1::uuid AND revoked_at IS NULL`,
    [input.sessionId, input.revokedBy ?? null],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function revokeAdminSessionByToken(
  db: Db,
  input: { token: string; revokedBy?: string | null },
): Promise<boolean> {
  const res = await db.query(
    `UPDATE admin_sessions
     SET revoked_at = now(), revoked_by = $2
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [opaqueHash(input.token), input.revokedBy ?? null],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function revokeAdminSessionsForIdentityClient(
  db: Db,
  input: { identityId: string; clientId: string; revokedBy?: string | null },
): Promise<number> {
  const res = await db.query(
    `UPDATE admin_sessions
     SET revoked_at = now(), revoked_by = $3
     WHERE identity_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
    [input.identityId, input.clientId, input.revokedBy ?? null],
  );
  return res.rowCount ?? 0;
}

export async function countActiveRoleGrants(
  db: Db,
  clientId: string,
  role: string,
): Promise<number> {
  const res = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM client_access_grants
     WHERE client_id = $1 AND role = $2 AND revoked_at IS NULL`,
    [clientId, role],
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function findConsentApproval(
  db: Db,
  input: ConsentKey,
): Promise<ConsentApproval | null> {
  const res = await db.query<ConsentApproval>(
    `SELECT id::text, identity_id, client_id, scope_hash, audience_hash, trust_tier,
            consent_version, approved_at::text, revoked_at::text
     FROM consent_approvals
     WHERE identity_id = $1
       AND client_id = $2
       AND scope_hash = $3
       AND audience_hash = $4
       AND trust_tier = $5
       AND consent_version = $6
       AND revoked_at IS NULL
     ORDER BY approved_at DESC
     LIMIT 1`,
    [
      input.identityId,
      input.clientId,
      listHash(input.scopes),
      listHash(input.audiences),
      input.trustTier,
      input.consentVersion,
    ],
  );
  return res.rows[0] ?? null;
}

export async function rememberConsentApproval(db: Db, input: ConsentKey): Promise<ConsentApproval> {
  const res = await db.query<ConsentApproval>(
    `INSERT INTO consent_approvals(
       identity_id, client_id, scope_hash, audience_hash, trust_tier, consent_version
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (identity_id, client_id, scope_hash, audience_hash, trust_tier, consent_version)
       WHERE revoked_at IS NULL
     DO UPDATE SET approved_at = now()
     RETURNING id::text, identity_id, client_id, scope_hash, audience_hash, trust_tier,
               consent_version, approved_at::text, revoked_at::text`,
    [
      input.identityId,
      input.clientId,
      listHash(input.scopes),
      listHash(input.audiences),
      input.trustTier,
      input.consentVersion,
    ],
  );
  return res.rows[0];
}

export async function revokeConsentApprovals(
  db: Db,
  identityId: string,
  clientId: string,
): Promise<void> {
  await db.query(
    `UPDATE consent_approvals
     SET revoked_at = now()
     WHERE identity_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
    [identityId, clientId],
  );
}

export async function auditConsentEvent(
  db: Db,
  input: {
    identityId?: string | null;
    clientId?: string | null;
    eventType: ConsentAuditType;
    reason?: string | null;
    scopes?: string[];
    audiences?: string[];
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO consent_audit_events(identity_id, client_id, event_type, reason, scopes, audiences, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.identityId ?? null,
      input.clientId ?? null,
      input.eventType,
      input.reason ?? null,
      canonicalList(input.scopes ?? []),
      canonicalList(input.audiences ?? []),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
