import type {
  AuthBrandDefinition,
  AuthBrandStatus,
  AuthClientConfigStatus,
  ConsentMode,
  LoginPolicyDefinition,
  OAuthClientAuthConfigSnapshot,
  ResolvedAuthConfiguration,
} from "@idnest/shared-types";
import type { Db } from "./db";

interface ResolvedRow {
  hydra_client_id: string;
  config_status: AuthClientConfigStatus;
  is_first_party: boolean;
  consent_mode: ConsentMode;
  mapping_version: number;
  brand_id: string;
  brand_status: AuthBrandStatus;
  brand_version: number;
  brand_definition: AuthBrandDefinition;
  login_policy_id: string;
  policy_status: AuthBrandStatus;
  login_policy_version: number;
  policy_definition: LoginPolicyDefinition;
}

export interface AuthBrandRecord {
  id: string;
  key: string;
  status: AuthBrandStatus;
  version: number;
  definition: AuthBrandDefinition;
  created_at: string;
  updated_at: string;
}

export interface LoginPolicyRecord {
  id: string;
  name: string;
  status: AuthBrandStatus;
  version: number;
  definition: LoginPolicyDefinition;
  created_at: string;
  updated_at: string;
}

export interface OAuthClientAuthConfigRecord {
  hydra_client_id: string;
  brand_id: string;
  brand_key: string;
  login_policy_id: string;
  login_policy_name: string;
  status: AuthClientConfigStatus;
  is_first_party: boolean;
  consent_mode: ConsentMode;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AuthConfigurationVersion<T> {
  version: number;
  value: T;
  created_by?: string | null;
  reason?: string | null;
  created_at: string;
}

function toResolved(row: ResolvedRow, usedFallback: boolean): ResolvedAuthConfiguration {
  return {
    client: {
      hydraClientId: row.hydra_client_id,
      status: row.config_status,
      isFirstParty: row.is_first_party,
      consentMode: row.consent_mode,
      brandId: row.brand_id,
      brandVersion: row.brand_version,
      loginPolicyId: row.login_policy_id,
      loginPolicyVersion: row.login_policy_version,
      mappingVersion: row.mapping_version,
    },
    brand: row.brand_definition,
    policy: row.policy_definition,
    usedFallback,
  };
}

const RESOLVED_SELECT = `
  SELECT
    c.hydra_client_id,
    c.status AS config_status,
    c.is_first_party,
    c.consent_mode,
    c.version AS mapping_version,
    b.id::text AS brand_id,
    b.status AS brand_status,
    b.current_version AS brand_version,
    bv.definition AS brand_definition,
    p.id::text AS login_policy_id,
    p.status AS policy_status,
    p.current_version AS login_policy_version,
    pv.definition AS policy_definition
  FROM oauth_client_auth_configs c
  JOIN auth_brands b ON b.id = c.brand_id
  JOIN auth_brand_versions bv
    ON bv.brand_id = b.id AND bv.version = b.current_version
  JOIN login_policies p ON p.id = c.login_policy_id
  JOIN login_policy_versions pv
    ON pv.login_policy_id = p.id AND pv.version = p.current_version
`;

export async function resolveAuthConfiguration(
  db: Db,
  hydraClientId: string,
): Promise<ResolvedAuthConfiguration> {
  const mapped = await db.query<ResolvedRow>(
    `${RESOLVED_SELECT} WHERE c.hydra_client_id = $1 LIMIT 1`,
    [hydraClientId],
  );
  const row = mapped.rows[0];
  if (
    row &&
    row.config_status !== "archived" &&
    row.brand_status === "active" &&
    row.policy_status === "active"
  ) {
    return toResolved(row, false);
  }

  const fallback = await db.query<ResolvedRow>(
    `SELECT
       $1::text AS hydra_client_id,
       'active'::text AS config_status,
       false AS is_first_party,
       'follow-hydra'::text AS consent_mode,
       0 AS mapping_version,
       b.id::text AS brand_id,
       b.status AS brand_status,
       b.current_version AS brand_version,
       bv.definition AS brand_definition,
       p.id::text AS login_policy_id,
       p.status AS policy_status,
       p.current_version AS login_policy_version,
       pv.definition AS policy_definition
     FROM auth_brands b
     JOIN auth_brand_versions bv
       ON bv.brand_id = b.id AND bv.version = b.current_version
     CROSS JOIN login_policies p
     JOIN login_policy_versions pv
       ON pv.login_policy_id = p.id AND pv.version = p.current_version
     WHERE b.key = 'idnest-default' AND p.name = 'default-public'
     LIMIT 1`,
    [hydraClientId],
  );
  if (!fallback.rows[0]) {
    throw new Error("Default Idnest brand or login policy is not configured");
  }
  const resolved = toResolved(fallback.rows[0], true);
  if (row?.config_status === "disabled") {
    resolved.client.status = "disabled";
  }
  return resolved;
}

export async function listAuthBrands(db: Db): Promise<AuthBrandRecord[]> {
  const res = await db.query<AuthBrandRecord>(
    `SELECT b.id::text, b.key, b.status, b.current_version AS version,
            bv.definition, b.created_at::text, b.updated_at::text
     FROM auth_brands b
     JOIN auth_brand_versions bv
       ON bv.brand_id = b.id AND bv.version = b.current_version
     WHERE b.status <> 'archived'
     ORDER BY b.key`,
  );
  return res.rows;
}

export async function getAuthBrand(db: Db, id: string): Promise<AuthBrandRecord | null> {
  const res = await db.query<AuthBrandRecord>(
    `SELECT b.id::text, b.key, b.status, b.current_version AS version,
            bv.definition, b.created_at::text, b.updated_at::text
     FROM auth_brands b
     JOIN auth_brand_versions bv
       ON bv.brand_id = b.id AND bv.version = b.current_version
     WHERE b.id = $1
     LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function listAuthBrandVersions(
  db: Db,
  id: string,
): Promise<AuthConfigurationVersion<AuthBrandDefinition>[]> {
  const res = await db.query<AuthConfigurationVersion<AuthBrandDefinition>>(
    `SELECT version, definition AS value, created_by, reason, created_at::text
     FROM auth_brand_versions
     WHERE brand_id = $1
     ORDER BY version DESC`,
    [id],
  );
  return res.rows;
}

export async function createAuthBrand(
  db: Db,
  input: {
    status: AuthBrandStatus;
    definition: AuthBrandDefinition;
    actor?: string | null;
    reason?: string | null;
  },
): Promise<AuthBrandRecord> {
  const inserted = await db.query<AuthBrandRecord>(
    `WITH brand AS (
       INSERT INTO auth_brands(key, status)
       VALUES ($1, $2)
       RETURNING *
     ), version AS (
       INSERT INTO auth_brand_versions(brand_id, version, definition, created_by, reason)
       SELECT id, 1, $3::jsonb, $4, $5 FROM brand
       RETURNING brand_id, definition
     )
     SELECT b.id::text, b.key, b.status, b.current_version AS version,
            v.definition, b.created_at::text, b.updated_at::text
     FROM brand b JOIN version v ON v.brand_id = b.id`,
    [
      input.definition.key,
      input.status,
      JSON.stringify(input.definition),
      input.actor ?? null,
      input.reason ?? null,
    ],
  );
  if (!inserted.rows[0]) throw new Error("Brand creation failed");
  return inserted.rows[0];
}

export async function updateAuthBrand(
  db: Db,
  id: string,
  expectedVersion: number,
  input: {
    status: AuthBrandStatus;
    definition: AuthBrandDefinition;
    actor?: string | null;
    reason?: string | null;
  },
): Promise<AuthBrandRecord | null> {
  const updated = await db.query<AuthBrandRecord>(
    `WITH brand AS (
       UPDATE auth_brands
       SET status = $3, current_version = current_version + 1, updated_at = now()
       WHERE id = $1 AND current_version = $2
       RETURNING *
     ), version AS (
       INSERT INTO auth_brand_versions(brand_id, version, definition, created_by, reason)
       SELECT id, current_version, $4::jsonb, $5, $6 FROM brand
       RETURNING brand_id, version, definition
     )
     SELECT b.id::text, b.key, b.status, v.version,
            v.definition, b.created_at::text, b.updated_at::text
     FROM brand b JOIN version v ON v.brand_id = b.id`,
    [
      id,
      expectedVersion,
      input.status,
      JSON.stringify(input.definition),
      input.actor ?? null,
      input.reason ?? null,
    ],
  );
  return updated.rows[0] ?? null;
}

export async function listLoginPolicies(db: Db): Promise<LoginPolicyRecord[]> {
  const res = await db.query<LoginPolicyRecord>(
    `SELECT p.id::text, p.name, p.status, p.current_version AS version,
            pv.definition, p.created_at::text, p.updated_at::text
     FROM login_policies p
     JOIN login_policy_versions pv
       ON pv.login_policy_id = p.id AND pv.version = p.current_version
     WHERE p.status <> 'archived'
     ORDER BY p.name`,
  );
  return res.rows;
}

export async function getLoginPolicy(db: Db, id: string): Promise<LoginPolicyRecord | null> {
  const res = await db.query<LoginPolicyRecord>(
    `SELECT p.id::text, p.name, p.status, p.current_version AS version,
            pv.definition, p.created_at::text, p.updated_at::text
     FROM login_policies p
     JOIN login_policy_versions pv
       ON pv.login_policy_id = p.id AND pv.version = p.current_version
     WHERE p.id = $1
     LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function listLoginPolicyVersions(
  db: Db,
  id: string,
): Promise<AuthConfigurationVersion<LoginPolicyDefinition>[]> {
  const res = await db.query<AuthConfigurationVersion<LoginPolicyDefinition>>(
    `SELECT version, definition AS value, created_by, reason, created_at::text
     FROM login_policy_versions
     WHERE login_policy_id = $1
     ORDER BY version DESC`,
    [id],
  );
  return res.rows;
}

export async function createLoginPolicy(
  db: Db,
  input: {
    status: AuthBrandStatus;
    definition: LoginPolicyDefinition;
    actor?: string | null;
    reason?: string | null;
  },
): Promise<LoginPolicyRecord> {
  const inserted = await db.query<LoginPolicyRecord>(
    `WITH policy AS (
       INSERT INTO login_policies(name, status)
       VALUES ($1, $2)
       RETURNING *
     ), version AS (
       INSERT INTO login_policy_versions(login_policy_id, version, definition, created_by, reason)
       SELECT id, 1, $3::jsonb, $4, $5 FROM policy
       RETURNING login_policy_id, definition
     )
     SELECT p.id::text, p.name, p.status, p.current_version AS version,
            v.definition, p.created_at::text, p.updated_at::text
     FROM policy p JOIN version v ON v.login_policy_id = p.id`,
    [
      input.definition.name,
      input.status,
      JSON.stringify(input.definition),
      input.actor ?? null,
      input.reason ?? null,
    ],
  );
  if (!inserted.rows[0]) throw new Error("Login policy creation failed");
  return inserted.rows[0];
}

export async function updateLoginPolicy(
  db: Db,
  id: string,
  expectedVersion: number,
  input: {
    status: AuthBrandStatus;
    definition: LoginPolicyDefinition;
    actor?: string | null;
    reason?: string | null;
  },
): Promise<LoginPolicyRecord | null> {
  const updated = await db.query<LoginPolicyRecord>(
    `WITH policy AS (
       UPDATE login_policies
       SET status = $3, current_version = current_version + 1, updated_at = now()
       WHERE id = $1 AND current_version = $2
       RETURNING *
     ), version AS (
       INSERT INTO login_policy_versions(login_policy_id, version, definition, created_by, reason)
       SELECT id, current_version, $4::jsonb, $5, $6 FROM policy
       RETURNING login_policy_id, version, definition
     )
     SELECT p.id::text, p.name, p.status, v.version,
            v.definition, p.created_at::text, p.updated_at::text
     FROM policy p JOIN version v ON v.login_policy_id = p.id`,
    [
      id,
      expectedVersion,
      input.status,
      JSON.stringify(input.definition),
      input.actor ?? null,
      input.reason ?? null,
    ],
  );
  return updated.rows[0] ?? null;
}

export async function listOAuthClientAuthConfigs(db: Db): Promise<OAuthClientAuthConfigRecord[]> {
  const res = await db.query<OAuthClientAuthConfigRecord>(
    `SELECT c.hydra_client_id, c.brand_id::text, b.key AS brand_key,
            c.login_policy_id::text, p.name AS login_policy_name, c.status,
            c.is_first_party, c.consent_mode, c.version,
            c.created_at::text, c.updated_at::text
     FROM oauth_client_auth_configs c
     JOIN auth_brands b ON b.id = c.brand_id
     JOIN login_policies p ON p.id = c.login_policy_id
     WHERE c.status <> 'archived'
     ORDER BY c.hydra_client_id`,
  );
  return res.rows;
}

export async function upsertOAuthClientAuthConfig(
  db: Db,
  input: {
    hydraClientId: string;
    brandId: string;
    loginPolicyId: string;
    status: AuthClientConfigStatus;
    isFirstParty: boolean;
    consentMode: ConsentMode;
    actor?: string | null;
    reason?: string | null;
  },
): Promise<OAuthClientAuthConfigRecord> {
  const res = await db.query<OAuthClientAuthConfigRecord>(
    `WITH config AS (
       INSERT INTO oauth_client_auth_configs(
         hydra_client_id, brand_id, login_policy_id, status, is_first_party, consent_mode
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (hydra_client_id) DO UPDATE
       SET brand_id = EXCLUDED.brand_id,
           login_policy_id = EXCLUDED.login_policy_id,
           status = EXCLUDED.status,
           is_first_party = EXCLUDED.is_first_party,
           consent_mode = EXCLUDED.consent_mode,
           version = oauth_client_auth_configs.version + 1,
           updated_at = now()
       RETURNING *
     ), history AS (
       INSERT INTO oauth_client_auth_config_versions(
         hydra_client_id, version, snapshot, created_by, reason
       )
       SELECT hydra_client_id, version,
         jsonb_build_object(
           'hydraClientId', hydra_client_id,
           'brandId', brand_id,
           'loginPolicyId', login_policy_id,
           'status', status,
           'isFirstParty', is_first_party,
           'consentMode', consent_mode,
           'mappingVersion', version
         ),
         $7, $8
       FROM config
       RETURNING hydra_client_id
     )
     SELECT c.hydra_client_id, c.brand_id::text, b.key AS brand_key,
            c.login_policy_id::text, p.name AS login_policy_name, c.status,
            c.is_first_party, c.consent_mode, c.version,
            c.created_at::text, c.updated_at::text
     FROM config c
     JOIN history h ON h.hydra_client_id = c.hydra_client_id
     JOIN auth_brands b ON b.id = c.brand_id
     JOIN login_policies p ON p.id = c.login_policy_id`,
    [
      input.hydraClientId,
      input.brandId,
      input.loginPolicyId,
      input.status,
      input.isFirstParty,
      input.consentMode,
      input.actor ?? null,
      input.reason ?? null,
    ],
  );
  if (!res.rows[0]) throw new Error("OAuth client auth configuration update failed");
  return res.rows[0];
}

export async function listOAuthClientAuthConfigVersions(
  db: Db,
  hydraClientId: string,
): Promise<AuthConfigurationVersion<OAuthClientAuthConfigSnapshot>[]> {
  const res = await db.query<AuthConfigurationVersion<OAuthClientAuthConfigSnapshot>>(
    `SELECT version, snapshot AS value, created_by, reason, created_at::text
     FROM oauth_client_auth_config_versions
     WHERE hydra_client_id = $1
     ORDER BY version DESC`,
    [hydraClientId],
  );
  return res.rows;
}

export async function archiveOAuthClientAuthConfig(db: Db, hydraClientId: string): Promise<boolean> {
  const res = await db.query(
    `UPDATE oauth_client_auth_configs
     SET status = 'archived', version = version + 1, updated_at = now()
     WHERE hydra_client_id = $1 AND status <> 'archived'`,
    [hydraClientId],
  );
  return (res.rowCount ?? 0) > 0;
}

export function clientSnapshotOf(resolved: ResolvedAuthConfiguration): OAuthClientAuthConfigSnapshot {
  return { ...resolved.client };
}
