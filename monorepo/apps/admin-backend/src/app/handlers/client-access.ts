import {
  countActiveRoleGrants,
  getActiveClientAccessGrant,
  getAuthzPool,
  grantClientAccess,
  listClientIdentityAccess,
  listIdentityClientAccess,
  revokeClientAccess,
  SYSTEM_ADMIN_ROLE,
} from "@idnest/authz-store";
import { getAdminOidcClientId, getAuthzDatabaseUrl } from "../config";
import { errorBody, type HandlerResult } from "./types";

function pool() {
  const db = getAuthzPool(getAuthzDatabaseUrl());
  if (!db) throw new Error("AUTHZ_DATABASE_URL is not configured");
  return db;
}

export interface IdentityClientAccessInput {
  id?: string;
}

export interface ClientIdentityAccessInput {
  client_id?: string;
}

export interface GrantClientAccessInput {
  id?: string;
  client_id?: string;
  role?: string;
  granted_by?: string | null;
}

export async function listIdentityClientGrants(input: IdentityClientAccessInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    return { status: 200, body: await listIdentityClientAccess(pool(), input.id) };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function listClientIdentityGrants(input: ClientIdentityAccessInput): Promise<HandlerResult> {
  try {
    if (!input.client_id) return { status: 400, body: { error: "client_id is required" } };
    return { status: 200, body: await listClientIdentityAccess(pool(), input.client_id) };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function grantIdentityClientAccess(input: GrantClientAccessInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    if (!input.client_id) return { status: 400, body: { error: "client_id is required" } };
    const grant = await grantClientAccess(pool(), {
      identityId: input.id,
      clientId: input.client_id,
      role: input.role || "user",
      grantedBy: input.granted_by ?? null,
    });
    return { status: 200, body: grant };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function revokeIdentityClientAccess(input: GrantClientAccessInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    if (!input.client_id) return { status: 400, body: { error: "client_id is required" } };
    const db = pool();
    const activeGrant = await getActiveClientAccessGrant(db, input.id, input.client_id);
    if (
      input.client_id === getAdminOidcClientId() &&
      activeGrant?.role === SYSTEM_ADMIN_ROLE &&
      (await countActiveRoleGrants(db, input.client_id, SYSTEM_ADMIN_ROLE)) <= 1
    ) {
      return { status: 400, body: { error: "Cannot revoke the final active system administrator" } };
    }
    const revoked = await revokeClientAccess(db, {
      identityId: input.id,
      clientId: input.client_id,
      revokedBy: input.granted_by ?? null,
    });
    return { status: 200, body: { revoked, identity_id: input.id, client_id: input.client_id } };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}
