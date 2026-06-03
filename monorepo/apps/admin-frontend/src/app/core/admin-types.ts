import type { KratosUser } from "@idnest/shared-types";

/** A Kratos verifiable address (email) as returned by the admin identity API. */
export interface KratosVerifiableAddress {
  value?: string;
  verified?: boolean;
  via?: string;
}

/** Kratos identity enriched with the admin-relevant fields the console reads. */
export interface AdminIdentity extends KratosUser {
  state?: "active" | "inactive";
  metadata_admin?: { role?: string } | null;
  verifiable_addresses?: KratosVerifiableAddress[];
  created_at?: string;
  updated_at?: string;
}

/** Response of GET /api/admin/me — the authorized caller's own identity. */
export interface AdminMe {
  email: string;
  identity: AdminIdentity;
  csrfToken: string;
}

/** A Hydra OAuth client (subset the console reads/writes). */
export interface HydraClient {
  client_id: string;
  client_name?: string;
  scope?: string;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  audience?: string[];
  token_endpoint_auth_method?: string;
}

/** Editable client form model used by the clients page. */
export interface ClientFormValue {
  client_id: string;
  client_name: string;
  public: boolean;
  scope: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  audience: string[];
}

/** A Kratos session (subset). */
export interface KratosSession {
  id: string;
  active?: boolean;
  expires_at?: string;
  authenticated_at?: string;
}

/** Best-effort display name / email helpers (traits are loosely typed). */
export function identityEmail(identity: AdminIdentity): string {
  const email = identity.traits?.["email"];
  return typeof email === "string" ? email : "";
}

export function identityName(identity: AdminIdentity): string {
  const name = identity.traits?.["name"];
  return typeof name === "string" && name ? name : identityEmail(identity) || identity.id;
}

export function isAdminRole(identity: AdminIdentity): boolean {
  return identity.metadata_admin?.role === "admin";
}

export function isEmailVerified(identity: AdminIdentity): boolean {
  const email = identityEmail(identity).trim().toLowerCase();
  return (identity.verifiable_addresses ?? []).some(
    (a) => String(a.value ?? "").trim().toLowerCase() === email && a.verified === true,
  );
}
