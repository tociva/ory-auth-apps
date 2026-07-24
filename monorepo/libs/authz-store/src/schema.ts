import type { Db } from "./db";

export const AUTHZ_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS auth_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_brand_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES auth_brands(id),
  version integer NOT NULL,
  definition jsonb NOT NULL,
  created_by text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, version)
);

CREATE TABLE IF NOT EXISTS login_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_policy_id uuid NOT NULL REFERENCES login_policies(id),
  version integer NOT NULL,
  definition jsonb NOT NULL,
  created_by text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (login_policy_id, version)
);

CREATE TABLE IF NOT EXISTS oauth_client_auth_configs (
  hydra_client_id text PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES auth_brands(id),
  login_policy_id uuid NOT NULL REFERENCES login_policies(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'archived')),
  is_first_party boolean NOT NULL DEFAULT false,
  consent_mode text NOT NULL DEFAULT 'follow-hydra'
    CHECK (consent_mode IN ('always-show', 'skip-for-first-party', 'follow-hydra')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_client_auth_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hydra_client_id text NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hydra_client_id, version)
);

CREATE TABLE IF NOT EXISTS auth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  hydra_login_challenge_hash text NOT NULL UNIQUE,
  hydra_login_challenge_ciphertext text NOT NULL,
  hydra_client_id text NOT NULL,
  brand_id uuid NOT NULL REFERENCES auth_brands(id),
  brand_version integer NOT NULL,
  login_policy_id uuid NOT NULL REFERENCES login_policies(id),
  login_policy_version integer NOT NULL,
  mapping_version integer NOT NULL,
  client_config_snapshot jsonb NOT NULL,
  brand_snapshot jsonb NOT NULL,
  policy_snapshot jsonb NOT NULL,
  kratos_flow_id text,
  subject text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'awaiting-authentication', 'completing', 'authenticated',
      'hydra-accepted', 'rejected', 'expired', 'failed'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completion_started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  redirect_to text
);

CREATE INDEX IF NOT EXISTS auth_transactions_expiry_idx
  ON auth_transactions(expires_at)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_transactions_client_created_idx
  ON auth_transactions(hydra_client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_consent_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  hydra_consent_challenge_hash text NOT NULL UNIQUE,
  hydra_consent_challenge_ciphertext text NOT NULL,
  hydra_login_challenge_hash text,
  hydra_client_id text NOT NULL,
  subject text NOT NULL,
  client_config_snapshot jsonb NOT NULL,
  brand_snapshot jsonb NOT NULL,
  policy_snapshot jsonb NOT NULL,
  requested_scopes text[] NOT NULL DEFAULT '{}',
  requested_audiences text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'completing', 'accepted', 'rejected', 'expired', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completion_started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  redirect_to text
);

CREATE INDEX IF NOT EXISTS auth_consent_transactions_expiry_idx
  ON auth_consent_transactions(expires_at)
  WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  hydra_client_id text,
  brand_id uuid,
  login_policy_id uuid,
  identity_id text,
  result text,
  failure_code text,
  correlation_id text,
  ip_hash text,
  user_agent_category text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_audit_events_client_created_idx
  ON auth_audit_events(hydra_client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_events_identity_created_idx
  ON auth_audit_events(identity_id, created_at DESC);

INSERT INTO auth_brands(key, status)
VALUES
  ('idnest-default', 'active'),
  ('daybook', 'active'),
  ('daybook-admin', 'active'),
  ('taskmesh', 'active'),
  ('idnest-admin', 'active')
ON CONFLICT (key) DO NOTHING;

INSERT INTO auth_brand_versions(brand_id, version, definition, created_by, reason)
SELECT b.id, 1, seed.definition, 'system', 'Initial trusted brand seed'
FROM (
  VALUES
    ('idnest-default', '{
      "key":"idnest-default","displayName":"Idnest","legalName":"Tociva Technologies",
      "productName":"Idnest","primaryColor":"#2563eb","secondaryColor":"#1d4ed8",
      "surfaceColor":"#ffffff","textColor":"#1f2937","mutedTextColor":"#6b7280",
      "errorColor":"#b91c1c","borderRadius":"16px","fontFamily":"system",
      "loginHeading":"Sign in to continue","loginDescription":"Use your Idnest identity to continue.",
      "registrationHeading":"Create your account","recoveryHeading":"Recover your account",
      "consentHeading":"Review access","supportUrl":"https://idnest.cloud/support",
      "privacyUrl":"/privacy","termsUrl":"/terms","copyrightText":"Tociva Technologies",
      "defaultLocale":"en"
    }'::jsonb),
    ('daybook', '{
      "key":"daybook","displayName":"Daybook.Cloud","legalName":"Tociva Technologies",
      "productName":"Daybook.Cloud","primaryColor":"#367588","secondaryColor":"#2c606f",
      "surfaceColor":"#ffffff","textColor":"#17252a","mutedTextColor":"#52666d",
      "errorColor":"#b42318","borderRadius":"16px","fontFamily":"roboto",
      "loginHeading":"Sign in to Daybook.Cloud","loginDescription":"Continue to your Daybook workspace.",
      "registrationHeading":"Create your Daybook account","recoveryHeading":"Recover your Daybook account",
      "consentHeading":"Review Daybook access","supportUrl":"https://daybook.cloud/support",
      "privacyUrl":"https://daybook.cloud/privacy","termsUrl":"https://daybook.cloud/terms",
      "copyrightText":"Daybook.Cloud","defaultLocale":"en"
    }'::jsonb),
    ('daybook-admin', '{
      "key":"daybook-admin","displayName":"Daybook Admin","legalName":"Tociva Technologies",
      "productName":"Daybook Admin","primaryColor":"#273f7a","secondaryColor":"#1e315f",
      "surfaceColor":"#ffffff","textColor":"#172033","mutedTextColor":"#667085",
      "errorColor":"#b42318","borderRadius":"12px","fontFamily":"roboto",
      "loginHeading":"Sign in to Daybook Admin","loginDescription":"Administrative access is restricted.",
      "registrationHeading":"Registration unavailable","recoveryHeading":"Recover your administrator account",
      "consentHeading":"Review administrative access","supportUrl":"https://daybook.cloud/support",
      "privacyUrl":"https://daybook.cloud/privacy",
      "termsUrl":"https://daybook.cloud/terms","copyrightText":"Daybook.Cloud","defaultLocale":"en"
    }'::jsonb),
    ('taskmesh', '{
      "key":"taskmesh","displayName":"Taskmesh","legalName":"Tociva Technologies",
      "productName":"Taskmesh","primaryColor":"#6d4aff","secondaryColor":"#5235d4",
      "surfaceColor":"#ffffff","textColor":"#201a33","mutedTextColor":"#6f6880",
      "errorColor":"#b42318","borderRadius":"14px","fontFamily":"system",
      "loginHeading":"Sign in to Taskmesh","loginDescription":"Continue to the Taskmesh console.",
      "registrationHeading":"Join Taskmesh","recoveryHeading":"Recover your Taskmesh account",
      "consentHeading":"Review Taskmesh access","supportUrl":"https://taskme.sh",
      "privacyUrl":"https://taskme.sh/privacy",
      "termsUrl":"https://taskme.sh/terms","copyrightText":"Taskmesh","defaultLocale":"en"
    }'::jsonb),
    ('idnest-admin', '{
      "key":"idnest-admin","displayName":"Idnest Admin","legalName":"Tociva Technologies",
      "productName":"Idnest Admin","primaryColor":"#193b45","secondaryColor":"#102c34",
      "surfaceColor":"#ffffff","textColor":"#142126","mutedTextColor":"#607078",
      "errorColor":"#b42318","borderRadius":"12px","fontFamily":"system",
      "loginHeading":"Sign in to Idnest Admin","loginDescription":"System administrator access only.",
      "registrationHeading":"Registration unavailable","recoveryHeading":"Recover administrator access",
      "consentHeading":"Review Idnest Admin access","supportUrl":"https://idnest.cloud/support",
      "privacyUrl":"/privacy","termsUrl":"/terms",
      "copyrightText":"Tociva Technologies","defaultLocale":"en"
    }'::jsonb)
) AS seed(key, definition)
JOIN auth_brands b ON b.key = seed.key
ON CONFLICT (brand_id, version) DO NOTHING;

INSERT INTO login_policies(name, status)
VALUES
  ('default-public', 'active'),
  ('daybook-public', 'active'),
  ('daybook-admin', 'active'),
  ('taskmesh-console', 'active'),
  ('idnest-admin', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO login_policy_versions(login_policy_id, version, definition, created_by, reason)
SELECT p.id, 1, seed.definition, 'system', 'Initial login policy seed'
FROM (
  VALUES
    ('default-public', '{
      "name":"Default public","passwordEnabled":false,"passkeyEnabled":false,
      "allowedOidcProviders":["google","apple"],"totpEnabled":false,"minimumAal":"aal1",
      "registrationMode":"enabled","accessMode":"open","allowedEmailDomains":[],
      "allowedEmails":[],"requireVerifiedEmail":true,"forceReauthentication":false,
      "sessionMaximumAgeSeconds":3600
    }'::jsonb),
    ('daybook-public', '{
      "name":"Daybook public","passwordEnabled":false,"passkeyEnabled":false,
      "allowedOidcProviders":["google"],"totpEnabled":false,"minimumAal":"aal1",
      "registrationMode":"enabled","accessMode":"open","allowedEmailDomains":[],
      "allowedEmails":[],"requireVerifiedEmail":true,"forceReauthentication":false,
      "sessionMaximumAgeSeconds":3600
    }'::jsonb),
    ('daybook-admin', '{
      "name":"Daybook administrator","passwordEnabled":false,"passkeyEnabled":false,
      "allowedOidcProviders":["google"],"totpEnabled":false,"minimumAal":"aal1",
      "registrationMode":"disabled","accessMode":"grant-required","allowedEmailDomains":[],
      "allowedEmails":[],"requireVerifiedEmail":true,"forceReauthentication":false,
      "sessionMaximumAgeSeconds":1800
    }'::jsonb),
    ('taskmesh-console', '{
      "name":"Taskmesh console","passwordEnabled":false,"passkeyEnabled":false,
      "allowedOidcProviders":["google"],"totpEnabled":false,"minimumAal":"aal1",
      "registrationMode":"invitation-only","accessMode":"grant-required","allowedEmailDomains":[],
      "allowedEmails":[],"requireVerifiedEmail":true,"forceReauthentication":false,
      "sessionMaximumAgeSeconds":3600
    }'::jsonb),
    ('idnest-admin', '{
      "name":"Idnest administrator","passwordEnabled":false,"passkeyEnabled":false,
      "allowedOidcProviders":["google"],"totpEnabled":true,"minimumAal":"aal2",
      "registrationMode":"disabled","accessMode":"grant-required","allowedEmailDomains":[],
      "allowedEmails":[],"requireVerifiedEmail":true,"forceReauthentication":false,
      "sessionMaximumAgeSeconds":900
    }'::jsonb)
) AS seed(name, definition)
JOIN login_policies p ON p.name = seed.name
ON CONFLICT (login_policy_id, version) DO NOTHING;

INSERT INTO oauth_client_auth_configs(
  hydra_client_id, brand_id, login_policy_id, status, is_first_party, consent_mode
)
SELECT seed.client_id, b.id, p.id, 'active', true, seed.consent_mode
FROM (
  VALUES
    ('daybook-web', 'daybook', 'daybook-public', 'skip-for-first-party'),
    ('daybook-admin', 'daybook-admin', 'daybook-admin', 'skip-for-first-party'),
    ('taskmesh-console', 'taskmesh', 'taskmesh-console', 'skip-for-first-party'),
    ('idnest-admin', 'idnest-admin', 'idnest-admin', 'skip-for-first-party'),
    ('idnest-admin-client', 'idnest-admin', 'idnest-admin', 'skip-for-first-party')
) AS seed(client_id, brand_key, policy_name, consent_mode)
JOIN auth_brands b ON b.key = seed.brand_key
JOIN login_policies p ON p.name = seed.policy_name
ON CONFLICT (hydra_client_id) DO NOTHING;

INSERT INTO oauth_client_auth_config_versions(
  hydra_client_id, version, snapshot, created_by, reason
)
SELECT c.hydra_client_id, c.version,
  jsonb_build_object(
    'hydraClientId', c.hydra_client_id,
    'brandId', c.brand_id,
    'loginPolicyId', c.login_policy_id,
    'status', c.status,
    'isFirstParty', c.is_first_party,
    'consentMode', c.consent_mode,
    'mappingVersion', c.version
  ),
  'system',
  'Initial OAuth client auth configuration seed'
FROM oauth_client_auth_configs c
ON CONFLICT (hydra_client_id, version) DO NOTHING;

INSERT INTO schema_migrations(version, name)
VALUES (1, 'auth platform base'), (2, 'client-specific branded authentication')
ON CONFLICT (version) DO NOTHING;
`;

export async function migrateAuthzSchema(db: Db): Promise<void> {
  await db.query(AUTHZ_SCHEMA_SQL);
}
