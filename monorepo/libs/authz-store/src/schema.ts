import type { Db } from "./db";

export const AUTHZ_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS client_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id text NOT NULL,
  client_id text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  granted_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS client_access_grants_active_unique
  ON client_access_grants(identity_id, client_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS client_access_grants_identity_idx
  ON client_access_grants(identity_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS client_access_grants_client_idx
  ON client_access_grants(client_id)
  WHERE revoked_at IS NULL;

UPDATE client_access_grants
SET role = 'system-admin'
WHERE role = 'admin'
  AND client_id = 'idnest-admin-client'
  AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  identity_id text NOT NULL,
  client_id text NOT NULL,
  role text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by text,
  request_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS admin_sessions_token_active_idx
  ON admin_sessions(token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_sessions_identity_client_active_idx
  ON admin_sessions(identity_id, client_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_oauth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  request_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS admin_oauth_transactions_active_idx
  ON admin_oauth_transactions(state_hash)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS consent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id text NOT NULL,
  client_id text NOT NULL,
  scope_hash text NOT NULL,
  audience_hash text NOT NULL,
  trust_tier text NOT NULL,
  consent_version integer NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_approvals_active_unique
  ON consent_approvals(identity_id, client_id, scope_hash, audience_hash, trust_tier, consent_version)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS consent_approvals_identity_client_idx
  ON consent_approvals(identity_id, client_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS consent_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id text,
  client_id text,
  event_type text NOT NULL,
  reason text,
  scopes text[] NOT NULL DEFAULT '{}',
  audiences text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_audit_events_identity_idx
  ON consent_audit_events(identity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS consent_audit_events_client_idx
  ON consent_audit_events(client_id, created_at DESC);
`;

export async function migrateAuthzSchema(db: Db): Promise<void> {
  await db.query(AUTHZ_SCHEMA_SQL);
}
